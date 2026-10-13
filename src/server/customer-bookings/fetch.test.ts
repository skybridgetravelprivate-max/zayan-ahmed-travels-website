import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { resolveAccountBookings } from "./resolve";
import { fetchCustomerBookingsForWebsiteCustomer } from "./fetch";
import type { CustomerBookingsResult } from "./fetch";
import type { CurrentCustomer } from "../customer-auth/session";

const SECRET_TOKEN = "website-customer-bookings-internal-token-32chars";
const ORIGIN = "https://crm.example.test";

function customer(id: string, crmCustomerId: string): CurrentCustomer {
  return {
    id,
    email: `${id}@example.test`,
    displayName: "Test Customer",
    crmCustomerId,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  };
}

let originalFetch: typeof globalThis.fetch;
const envKeys = ["CRM_API_URL", "CUSTOMER_BOOKINGS_INTERNAL_TOKEN"] as const;
let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  originalFetch = globalThis.fetch;
  savedEnv = {};
  for (const key of envKeys) {
    savedEnv[key] = process.env[key];
  }
  process.env.CRM_API_URL = ORIGIN;
  process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN = SECRET_TOKEN;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

test("signed-out resolveAccountBookings → 401 without calling CRM", async () => {
  let fetchCalled = false;
  const resolved = await resolveAccountBookings(null, async () => {
    fetchCalled = true;
    return { ok: true, bookings: [] };
  });
  assert.equal(resolved.status, 401);
  assert.equal(resolved.body.ok, false);
  assert.equal(fetchCalled, false);
  assert.equal(JSON.stringify(resolved.body).includes(SECRET_TOKEN), false);
});

test("signed-in customer A → CRM request uses A's customer id", async () => {
  let usedId = "";
  const resolved = await resolveAccountBookings(customer("customer-a", "crm-customer-a"), async (id) => {
    usedId = id;
    return {
      ok: true,
      bookings: [
        {
          reference: "ZAT-1",
          service: "Flight",
          destination: "Dubai",
          travelDate: "2026-12-01",
          status: "Upcoming",
          createdAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-02T00:00:00.000Z",
        },
      ],
    };
  });
  assert.equal(usedId, "customer-a");
  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.ok, true);
});

test("browser-supplied customer id cannot override session identity", async () => {
  let usedId = "";
  // Simulate a handler that only receives session customer; query "customer-b" is never passed in.
  const browserQueryCustomerId = "customer-b";
  void browserQueryCustomerId;
  await resolveAccountBookings(customer("customer-a", "crm-customer-a"), async (id) => {
    usedId = id;
    return { ok: true, bookings: [] };
  });
  assert.equal(usedId, "customer-a");
  assert.notEqual(usedId, "customer-b");
});

test("fetch uses internal token header and strips CRM financial fields", async () => {
  let calledUrl = "";
  let calledHeaders: HeadersInit | undefined;
  globalThis.fetch = (async (input, init) => {
    calledUrl = String(input);
    calledHeaders = init?.headers;
    return new Response(
      JSON.stringify({
        bookings: [
          {
            reference: "ZAT-BK-9",
            service: "Visa",
            destination: "Turkey",
            travelDate: "2026-08-01",
            status: "Upcoming",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
            sellingPrice: 400,
            profit: 12,
            notes: "internal",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  const result = await fetchCustomerBookingsForWebsiteCustomer("cust-aaa");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const json = JSON.stringify(result.bookings);
  assert.equal(json.includes("400"), false);
  assert.equal(json.includes("profit"), false);
  assert.equal(json.includes("internal"), false);
  assert.equal(json.includes(SECRET_TOKEN), false);
  assert.match(calledUrl, /website_customer_id=cust-aaa/);
  const headers = new Headers(calledHeaders);
  assert.equal(headers.get("X-Zat-Internal-Token"), SECRET_TOKEN);
  assert.equal(headers.get("Authorization"), null);
});

test("CRM failure → sanitized 503 without token or CRM internals", async () => {
  for (const status of [401, 403, 500, 503]) {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "Mongo detail", stack: "at x", token: SECRET_TOKEN }), {
        status,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;
    const resolved = await resolveAccountBookings(customer("cust-a", "crm-cust-a"));
    assert.equal(resolved.status, 503);
    assert.equal(resolved.body.ok, false);
    const text = JSON.stringify(resolved.body);
    assert.equal(text.includes("Mongo"), false);
    assert.equal(text.includes(SECRET_TOKEN), false);
    assert.equal(text.includes("stack"), false);
  }
});

test("missing configuration → 503 and no outbound CRM call", async () => {
  delete process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN;
  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const result: CustomerBookingsResult = await fetchCustomerBookingsForWebsiteCustomer("cust-a");
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 503);
  assert.equal(fetchCalled, false);
});
