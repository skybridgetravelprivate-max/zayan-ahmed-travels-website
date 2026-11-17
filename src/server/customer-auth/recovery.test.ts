import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  customerRecoveryInvalidMessage,
  customerRecoveryRequestMessage,
  customerRecoveryResetMessage,
  customerRecoveryUnavailableMessage,
} from "@/lib/customer-recovery";
import {
  requestCustomerPasswordRecovery,
  resetCustomerPassword,
} from "./recovery";

const internalToken = "customer-recovery-internal-token-32chars";
const origin = "https://crm.example.test";
const envKeys = ["CRM_API_URL", "CUSTOMER_BOOKINGS_INTERNAL_TOKEN"] as const;
const savedEnv = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of envKeys) savedEnv.set(key, process.env[key]);
  process.env.CRM_API_URL = origin;
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

test("recovery request normalizes email and sends only a server-side internal request", async () => {
  let requestUrl = "";
  let requestHeaders: HeadersInit | undefined;
  let requestBody = "";
  const result = await requestCustomerPasswordRecovery(
    { email: " CUSTOMER@EXAMPLE.TEST " },
    (async (input, init) => {
      requestUrl = String(input);
      requestHeaders = init?.headers;
      requestBody = String(init?.body);
      return Response.json({ ok: true });
    }) as typeof fetch,
  );

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true, message: customerRecoveryRequestMessage });
  assert.equal(requestUrl, `${origin}/v1/customer/forgot-password`);
  assert.deepEqual(JSON.parse(requestBody), { email: "customer@example.test" });
  const headers = new Headers(requestHeaders);
  assert.equal(headers.get("X-Zat-Internal-Token"), internalToken);
  assert.equal(headers.get("Authorization"), null);
  assert.equal(JSON.stringify(result.body).includes("customer@example.test"), false);
});

test("malformed addresses are rejected before contacting the backend", async () => {
  let calls = 0;
  const result = await requestCustomerPasswordRecovery(
    { email: "not-an-email" },
    (async () => { calls++; return Response.json({ ok: true }); }) as typeof fetch,
  );
  assert.equal(result.status, 400);
  assert.equal(calls, 0);
});

test("invalid reset tokens and passwords are rejected without forwarding them", async () => {
  let calls = 0;
  const fetcher = (async () => { calls++; return Response.json({ ok: true }); }) as typeof fetch;
  const malformed = await resetCustomerPassword({ token: "bad", password: "Synthetic-new-password!" }, fetcher);
  const weak = await resetCustomerPassword({ token: "a".repeat(64), password: "short" }, fetcher);
  assert.equal(malformed.status, 400);
  assert.equal(weak.status, 400);
  assert.equal(calls, 0);
});

test("valid reset requests return only the generic completion message", async () => {
  const rawToken = "d".repeat(64);
  const password = "Synthetic-new-password!";
  let requestUrl = "";
  let requestBody = "";
  const result = await resetCustomerPassword(
    { token: rawToken, password },
    (async (input, init) => {
      requestUrl = String(input);
      requestBody = String(init?.body);
      return Response.json({ ok: true });
    }) as typeof fetch,
  );
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true, message: customerRecoveryResetMessage });
  assert.equal(requestUrl, `${origin}/v1/customer/reset-password`);
  assert.deepEqual(JSON.parse(requestBody), { token: rawToken, password });
});

test("invalid backend links and recovery failures return sanitized responses", async () => {
  delete process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN;
  let calls = 0;
  const missing = await requestCustomerPasswordRecovery(
    { email: "customer@example.test" },
    (async () => { calls++; return Response.json({ ok: true }); }) as typeof fetch,
  );
  assert.equal(missing.status, 503);
  assert.equal(missing.body.error, customerRecoveryUnavailableMessage);
  assert.equal(calls, 0);

  process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN = internalToken;
  const failed = await resetCustomerPassword(
    { token: "c".repeat(64), password: "Synthetic-new-password!" },
    (async () => Response.json({ message: "private token detail" }, { status: 400 })) as typeof fetch,
  );
  assert.equal(failed.status, 400);
  assert.equal(failed.body.error, customerRecoveryInvalidMessage);
  assert.doesNotMatch(JSON.stringify(failed.body), /private token detail|c{64}/);

  const unavailable = await requestCustomerPasswordRecovery(
    { email: "customer@example.test" },
    (async () => { throw new Error("private network detail"); }) as typeof fetch,
  );
  assert.equal(unavailable.status, 503);
  assert.doesNotMatch(JSON.stringify(unavailable.body), /private network detail|customer@example\.test/);
});
