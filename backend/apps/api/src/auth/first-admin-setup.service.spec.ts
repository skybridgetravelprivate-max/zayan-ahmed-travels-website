import assert from "node:assert/strict";
import { after, test } from "node:test";
import { ConflictException } from "@nestjs/common";
import type { PrismaService } from "../common/prisma.service";
import { FirstAdminSetupService } from "./first-admin-setup.service";
import { verifyPassword } from "../common/password";

const SETUP_TOKEN = "first-admin-setup-token-for-tests-0001";
const previousToken = process.env.FIRST_ADMIN_SETUP_TOKEN;
const previousEnvironment = process.env.NODE_ENV;
process.env.FIRST_ADMIN_SETUP_TOKEN = SETUP_TOKEN;
process.env.NODE_ENV = "development";

after(() => {
  if (previousToken === undefined) delete process.env.FIRST_ADMIN_SETUP_TOKEN;
  else process.env.FIRST_ADMIN_SETUP_TOKEN = previousToken;
  if (previousEnvironment === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousEnvironment;
});

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    setupToken: SETUP_TOKEN,
    email: "admin@example.test",
    username: "admin",
    fullName: "Initial Administrator",
    password: "correct horse battery staple",
    ...overrides,
  };
}

function createHarness(initialUsers = 0, serializeTransactions = false) {
  let users = initialUsers;
  let transactions = 0;
  let userCreates = 0;
  let lockCalls = 0;
  let createdData: Record<string, unknown> | undefined;
  let queue = Promise.resolve();
  const role = { id: "role-super-admin" };
  const permission = { id: "permission-dashboard-view" };
  const tx = {
    $queryRaw: async () => {
      lockCalls += 1;
      return [];
    },
    user: {
      count: async () => users,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createdData = data;
        users += 1;
        userCreates += 1;
        return {
          id: "user-first-admin",
          email: data.email,
          username: data.username,
          fullName: data.fullName,
        };
      },
    },
    role: { upsert: async () => role },
    permission: { upsert: async () => permission },
    rolePermission: { upsert: async () => undefined },
    userRole: { create: async () => undefined },
  };
  const prisma = {
    user: { count: async () => users },
    $transaction: async (work: (transaction: typeof tx) => Promise<unknown>) => {
      transactions += 1;
      if (!serializeTransactions) return work(tx);

      const previous = queue;
      let release = () => {};
      queue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await work(tx);
      } finally {
        release();
      }
    },
  } as unknown as PrismaService;

  return {
    service: new FirstAdminSetupService(prisma),
    get transactions() {
      return transactions;
    },
    get userCreates() {
      return userCreates;
    },
    get lockCalls() {
      return lockCalls;
    },
    get createdData() {
      return createdData;
    },
  };
}

test("rejects missing or incorrect setup token before opening a transaction", async () => {
  const harness = createHarness();

  await assert.rejects(harness.service.createFirstAdmin(validInput({ setupToken: undefined })), {
    status: 401,
  });
  await assert.rejects(harness.service.createFirstAdmin(validInput({ setupToken: "incorrect-token-value-000000000000" })), {
    status: 401,
  });
  assert.equal(harness.transactions, 0);
});

test("enforces existing password policy before opening a transaction", async () => {
  const harness = createHarness();

  await assert.rejects(
    harness.service.createFirstAdmin(validInput({ password: "short" })),
    /at least 10 characters/,
  );
  assert.equal(harness.transactions, 0);
  await assert.rejects(
    harness.service.createFirstAdmin(validInput({ password: "🔐".repeat(20) })),
    /at most 72 UTF-8 bytes/,
  );
  assert.equal(harness.transactions, 0);
});

test("serializes concurrent setup attempts and creates only one administrator", async () => {
  const harness = createHarness(0, true);
  const first = harness.service.createFirstAdmin(validInput());
  const second = harness.service.createFirstAdmin(
    validInput({ email: "second@example.test", username: "second" }),
  );

  const results = await Promise.allSettled([first, second]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.ok(rejected && rejected.status === "rejected");
  assert.ok(rejected.reason instanceof ConflictException);
  assert.equal(harness.userCreates, 1);
  assert.equal(harness.lockCalls, 2);
});

test("reports setup unavailable and refuses another administrator after success", async () => {
  const harness = createHarness();

  assert.equal(await harness.service.isAvailable(), true);
  await harness.service.createFirstAdmin(validInput());
  assert.equal(await harness.service.isAvailable(), false);
  await assert.rejects(
    harness.service.createFirstAdmin(validInput({ email: "second@example.test", username: "second" })),
    (error: { status?: number }) => error.status === 409,
  );
  assert.equal(harness.userCreates, 1);
  assert.notEqual(harness.createdData?.passwordHash, validInput().password);
  assert.equal(await verifyPassword(validInput().password, String(harness.createdData?.passwordHash)), true);
});

test("setup requires explicit development mode and a configured token", async () => {
  const harness = createHarness();
  try {
    for (const environment of [undefined, "test", "staging", "production"]) {
      if (environment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = environment;
      assert.equal(await harness.service.isAvailable(), false);
      await assert.rejects(harness.service.createFirstAdmin(validInput()), { status: 404 });
    }
    process.env.NODE_ENV = "development";
    delete process.env.FIRST_ADMIN_SETUP_TOKEN;
    assert.equal(await harness.service.isAvailable(), false);
    await assert.rejects(harness.service.createFirstAdmin(validInput()), { status: 404 });
    assert.equal(harness.transactions, 0);
  } finally {
    process.env.NODE_ENV = "development";
    process.env.FIRST_ADMIN_SETUP_TOKEN = SETUP_TOKEN;
  }
});

test("keeps first-admin setup disabled in production", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const harness = createHarness();

  try {
    assert.equal(await harness.service.isAvailable(), false);
    await assert.rejects(harness.service.createFirstAdmin(validInput()), { status: 404 });
    assert.equal(harness.transactions, 0);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});
