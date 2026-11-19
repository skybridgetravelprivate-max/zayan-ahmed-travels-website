import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";
import { verifyPassword } from "../common/password";
import { WebsiteCustomerRecoveryController } from "./website-customer-recovery.controller";

const internalToken = "synthetic-customer-recovery-internal-token-32chars";
const email = "customer@example.test";
const customer = { id: "customer-a", email, passwordHash: "old-hash", updatedAt: new Date() };
const savedEnv = new Map<string, string | undefined>();
const envKeys = ["SMTP_HOST", "SITE_URL", "APP_URL", "NODE_ENV", "CUSTOMER_BOOKINGS_INTERNAL_TOKEN"] as const;

beforeEach(() => {
  for (const key of envKeys) savedEnv.set(key, process.env[key]);
  process.env.SMTP_HOST = "smtp.synthetic.invalid";
  process.env.SITE_URL = "https://travel.example.test";
  process.env.NODE_ENV = "production";
  process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN = internalToken;
});

afterEach(() => {
  for (const key of envKeys) {
    const value = savedEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  savedEnv.clear();
});

test("customer recovery is generic for unknown emails and unavailable mail fails before lookup", async () => {
  let lookups = 0;
  let deliveries = 0;
  const prisma = {
    websiteCustomer: { findUnique: async () => { lookups++; return null; } },
  };
  const controller = new WebsiteCustomerRecoveryController(
    prisma as never,
    { send: async () => { deliveries++; return { accepted: [email] }; } } as never,
  );

  delete process.env.SMTP_HOST;
  await assert.rejects(
    controller.forgot({ email }, internalToken),
    (error: unknown) => (error as { getStatus(): number }).getStatus() === 503,
  );
  assert.equal(lookups, 0);

  process.env.SMTP_HOST = "smtp.synthetic.invalid";
  assert.deepEqual(await controller.forgot({ email: ` ${email.toUpperCase()} ` }, internalToken), { ok: true });
  assert.equal(lookups, 1);
  assert.equal(deliveries, 0);
});

test("customer recovery stores only a hashed, expiring token and emails the account reset URL", async () => {
  let created: Record<string, unknown> | null = null;
  let deliveredTo = "";
  let deliveredHtml = "";
  const transaction = {
    websiteCustomerPasswordResetToken: {
      updateMany: async () => ({ count: 0 }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        created = { id: "reset-row", ...data };
        return created;
      },
    },
  };
  const prisma = {
    websiteCustomer: { findUnique: async () => customer },
    $transaction: async (run: (tx: typeof transaction) => unknown) => run(transaction),
    websiteCustomerPasswordResetToken: { updateMany: async () => ({ count: 1 }) },
  };
  const controller = new WebsiteCustomerRecoveryController(
    prisma as never,
    {
      send: async (to: string, _subject: string, html: string) => {
        deliveredTo = to;
        deliveredHtml = html;
        return { accepted: [to] };
      },
    } as never,
  );

  assert.deepEqual(await controller.forgot({ email }, internalToken), { ok: true });
  assert.equal(deliveredTo, email);
  assert.ok(created);
  const tokenHash = created!.tokenHash as string;
  const token = deliveredHtml.match(/token=([a-f0-9]{64})/)?.[1];
  assert.ok(token);
  assert.equal(tokenHash, createHash("sha256").update(token!).digest("hex"));
  assert.notEqual(tokenHash, token);
  const link = new URL(deliveredHtml.match(/href="([^"]+)"/)![1]);
  assert.equal(link.origin, "https://travel.example.test");
  assert.equal(link.pathname, "/account/reset-password");
  assert.equal(new Date(created!.expiresAt as Date).getTime() - Date.now() <= 60 * 60 * 1000, true);
});

test("failed customer email delivery invalidates the unissued token without logging provider details", async () => {
  let tokenUsed = false;
  let warning = "";
  const transaction = {
    websiteCustomerPasswordResetToken: {
      updateMany: async () => ({ count: 0 }),
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "reset-row", ...data }),
    },
  };
  const prisma = {
    websiteCustomer: { findUnique: async () => customer },
    $transaction: async (run: (tx: typeof transaction) => unknown) => run(transaction),
    websiteCustomerPasswordResetToken: {
      updateMany: async () => { tokenUsed = true; return { count: 1 }; },
    },
  };
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => { warning = args.join(" "); };
  try {
    const controller = new WebsiteCustomerRecoveryController(
      prisma as never,
      { send: async () => { throw new Error("private smtp response"); } } as never,
    );
    assert.deepEqual(await controller.forgot({ email }, internalToken), { ok: true });
    assert.equal(tokenUsed, true);
    assert.doesNotMatch(warning, /private smtp response|customer@example\.test/);
  } finally {
    console.warn = originalWarn;
  }
});

test("customer reset is single-use, updates the password and revokes sessions and sibling tokens", async () => {
  const rawToken = "a".repeat(64);
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  let claimed = false;
  let storedPasswordHash = customer.passwordHash;
  let sessionsRevoked = false;
  let siblingTokensUsed = false;
  const transaction = {
    websiteCustomerPasswordResetToken: {
      updateMany: async ({ where }: { where: { id?: string } }) => {
        if (where.id === "reset-row") {
          if (claimed) return { count: 0 };
          claimed = true;
          return { count: 1 };
        }
        siblingTokensUsed = true;
        return { count: 1 };
      },
    },
    websiteCustomer: {
      update: async ({ data }: { data: { passwordHash: string } }) => {
        storedPasswordHash = data.passwordHash;
      },
    },
    websiteCustomerSession: {
      updateMany: async () => { sessionsRevoked = true; return { count: 1 }; },
    },
  };
  const prisma = {
    websiteCustomerPasswordResetToken: {
      findFirst: async () => claimed ? null : {
        id: "reset-row",
        customerId: customer.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      },
    },
    $transaction: async (run: (tx: typeof transaction) => unknown) => run(transaction),
  };
  const controller = new WebsiteCustomerRecoveryController(prisma as never, {} as never);
  const reset = () => controller.reset({ token: rawToken, password: "Synthetic-new-password!" }, internalToken);
  const outcomes = await Promise.allSettled([reset(), reset()]);

  assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(await verifyPassword("Synthetic-new-password!", storedPasswordHash), true);
  assert.equal(await verifyPassword("old-customer-password", storedPasswordHash), false);
  assert.equal(sessionsRevoked, true);
  assert.equal(siblingTokensUsed, true);
  await assert.rejects(reset(), (error: unknown) => (error as { getStatus(): number }).getStatus() === 400);
});

test("expired and malformed customer recovery tokens cannot change a password", async () => {
  let lookups = 0;
  const prisma = {
    websiteCustomerPasswordResetToken: {
      findFirst: async () => { lookups++; return null; },
    },
  };
  const controller = new WebsiteCustomerRecoveryController(prisma as never, {} as never);
  await assert.rejects(
    controller.reset({ token: "expired-token", password: "Synthetic-new-password!" }, internalToken),
    (error: unknown) => (error as { getStatus(): number }).getStatus() === 400,
  );
  await assert.rejects(
    controller.reset({ token: "b".repeat(64), password: "short" }, internalToken),
    (error: unknown) => (error as { getStatus(): number }).getStatus() === 400,
  );
  assert.equal(lookups, 0);
});

test("a token that expires after lookup cannot change the password or revoke sessions", async (t) => {
  const start = new Date("2026-11-17T12:00:00Z");
  const expiresAt = new Date(start.getTime() + 1000);
  t.mock.timers.enable({ apis: ["Date"], now: start });
  let claimAttempts = 0;
  const transaction = {
    websiteCustomerPasswordResetToken: {
      updateMany: async ({ where }: { where: { expiresAt: { gt: Date } } }) => {
        claimAttempts++;
        return { count: expiresAt > where.expiresAt.gt ? 1 : 0 };
      },
    },
    websiteCustomer: { update: async () => assert.fail("Password was changed") },
    websiteCustomerSession: { updateMany: async () => assert.fail("Sessions were revoked") },
  };
  const prisma = {
    websiteCustomerPasswordResetToken: {
      findFirst: async ({ where }: { where: { expiresAt: { gt: Date } } }) => {
        assert.ok(expiresAt > where.expiresAt.gt);
        return { id: "reset-row", customerId: customer.id, expiresAt };
      },
    },
    $transaction: async (run: (tx: typeof transaction) => unknown) => {
      t.mock.timers.setTime(expiresAt.getTime());
      return run(transaction);
    },
  };
  const controller = new WebsiteCustomerRecoveryController(prisma as never, {} as never);
  await assert.rejects(
    controller.reset({ token: "c".repeat(64), password: "Synthetic-new-password!" }, internalToken),
    (error: unknown) => (error as { getStatus(): number }).getStatus() === 400,
  );
  assert.equal(claimAttempts, 1);
});
