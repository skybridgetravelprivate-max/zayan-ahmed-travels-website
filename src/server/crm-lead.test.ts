import assert from "node:assert/strict";
import { test } from "node:test";
import { createInquiryLead, CrmRequestError } from "./crm-lead";
import { submitInquiry } from "../components/forms/inquiry-submit";

test("a lost inquiry response retains the key for the same payload", async () => {
  const originalFetch = globalThis.fetch;
  const keys: (string | null)[] = [];
  const pending = { current: null };
  try {
    globalThis.fetch = async (_url, init) => {
      keys.push(new Headers(init?.headers).get("Idempotency-Key"));
      if (keys.length === 1) throw new Error("response lost");
      return Response.json({ ok: true });
    };
    await assert.rejects(submitInquiry(pending, '{"message":"first"}'), /response lost/);
    await submitInquiry(pending, '{"message":"first"}');
    await submitInquiry(pending, '{"message":"edited"}');
    assert.ok(keys[0]);
    assert.equal(keys[0], keys[1]);
    assert.notEqual(keys[0], keys[2]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("inquiries use server token without staff login and require a persisted lead id", async () => {
  const before = { url: process.env.CRM_API_URL, token: process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN };
  const originalFetch = globalThis.fetch;
  process.env.CRM_API_URL = "http://127.0.0.1:4000";
  process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN = "test-internal-token-with-at-least-32-characters";
  const input = { type: "contact" as const, name: "Test", phone: "+923001234567", email: "test@example.com", message: "Question" };
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(String(url), "http://127.0.0.1:4000/api/v1/website/inquiries");
      assert.equal(new Headers(init?.headers).get("X-Zat-Internal-Token"), process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN);
      assert.equal(init?.cache, "no-store");
      assert.equal(new Headers(init?.headers).get("Idempotency-Key"), "test-inquiry-key");
      assert.equal(JSON.parse(String(init?.body)).fullName, "Test");
      return Response.json({ id: "saved-lead" }, { status: 201 });
    };
    await createInquiryLead(input, "test-inquiry-key");
    globalThis.fetch = async () => Response.json({ ok: true });
    await assert.rejects(createInquiryLead(input), CrmRequestError);
    globalThis.fetch = async () => Response.json({}, { status: 401 });
    await assert.rejects(createInquiryLead(input), CrmRequestError);
  } finally {
    globalThis.fetch = originalFetch;
    if (before.url === undefined) delete process.env.CRM_API_URL; else process.env.CRM_API_URL = before.url;
    if (before.token === undefined) delete process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN; else process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN = before.token;
  }
});
