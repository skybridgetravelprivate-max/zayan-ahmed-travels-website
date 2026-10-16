import assert from "node:assert/strict";
import { test } from "node:test";
import { loginCustomer } from "@/server/customer-auth/login";
import { hashPassword, verifyPassword } from "@/server/customer-auth/password";
import {
  logoutCustomer,
  resolveCustomerSession,
} from "@/server/customer-auth/session";
import { registerCustomer } from "@/server/customer-auth/register";
import { CustomerRecordError, type CustomerRecord, type SessionRecord } from "@/server/customer-db/repository";

const customer: CustomerRecord = {
  id: "website-customer-a",
  email: "a@example.test",
  passwordHash: "",
  displayName: "Customer A",
  crmCustomerId: "crm-customer-a",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const session: SessionRecord = {
  id: "session-a",
  customerId: customer.id,
  tokenHash: "sha256-token-hash",
  expiresAt: "2026-01-08T00:00:00.000Z",
  revokedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

test("registration normalizes email and returns the existing duplicate response", async () => {
  const emails = new Set<string>();
  const resultFor = (email: string) =>
    registerCustomer(
      {
        email,
        password: "long-enough-password",
        confirmPassword: "long-enough-password",
        displayName: "Customer",
      },
      {
        hashPassword: async () => "bcrypt-hash",
        insertCustomer: async (input) => {
          const normalized = input.email.trim().toLowerCase();
          if (emails.has(normalized)) {
            throw new CustomerRecordError("A customer with this email already exists.", "email-taken");
          }
          emails.add(normalized);
          return { ...customer, email: normalized, passwordHash: input.passwordHash };
        },
        linkWebsiteCustomerToCrm: async () => null,
      },
    );

  assert.equal((await resultFor(" Person@Example.Test ")).status, 201);
  const duplicate = await resultFor("person@example.test");
  assert.equal(duplicate.status, 400);
  assert.equal(duplicate.body.ok, false);
});

test("login verifies bcrypt hashes and rejects an incorrect password", async () => {
  const passwordHash = await hashPassword("a-correct-password");
  const signedIn: string[] = [];
  const dependencies = {
    findCustomerByEmail: async () => ({ ...customer, passwordHash }),
    verifyPassword,
    createSession: async (id: string) => {
      signedIn.push(id);
    },
    linkWebsiteCustomerToCrm: async () => null,
  };

  const invalid = await loginCustomer(
    { email: customer.email, password: "incorrect-password" },
    dependencies,
  );
  assert.equal(invalid.status, 401);
  assert.deepEqual(signedIn, []);

  const valid = await loginCustomer(
    { email: customer.email, password: "a-correct-password" },
    dependencies,
  );
  assert.equal(valid.status, 200);
  assert.deepEqual(signedIn, [customer.id]);
});

test("expired and revoked sessions never resolve to a customer", async () => {
  let customerLookups = 0;
  const repository = {
    findSessionByTokenHash: async () => session,
    findCustomerById: async () => {
      customerLookups += 1;
      return customer;
    },
    revokeSessionByTokenHash: async () => {},
  };

  assert.equal(
    await resolveCustomerSession(session.tokenHash, "2026-01-09T00:00:00.000Z", repository),
    null,
  );
  assert.equal(
    await resolveCustomerSession(
      session.tokenHash,
      "2026-01-02T00:00:00.000Z",
      { ...repository, findSessionByTokenHash: async () => ({ ...session, revokedAt: "2026-01-02T00:00:00.000Z" }) },
    ),
    null,
  );
  assert.equal(customerLookups, 0);

  const activeCustomer = await resolveCustomerSession(
    session.tokenHash,
    "2026-01-02T00:00:00.000Z",
    repository,
  );
  assert.equal(activeCustomer?.id, customer.id);
  assert.equal(activeCustomer?.crmCustomerId, customer.crmCustomerId);
});

test("logout revokes the current token hash and does nothing without a session", async () => {
  const revoked: string[] = [];
  let cleanupCalls = 0;
  let cookieClears = 0;
  const repository = {
    deleteExpiredSessions: async () => {
      cleanupCalls += 1;
    },
    revokeSessionByTokenHash: async (tokenHash: string) => {
      revoked.push(tokenHash);
    },
  };
  const clearCookie = async () => {
    cookieClears += 1;
  };
  await logoutCustomer(session.tokenHash, clearCookie, repository);
  await logoutCustomer(null, clearCookie, repository);
  assert.deepEqual(revoked, [session.tokenHash]);
  assert.equal(cleanupCalls, 2);
  assert.equal(cookieClears, 2);
});
