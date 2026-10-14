import assert from "node:assert/strict";
import { test } from "node:test";
import { publicRateLimitResponse } from "./public-rate-limit";

function request(forwardedFor: string) {
  return new Request("http://localhost", {
    headers: { "x-forwarded-for": forwardedFor },
  });
}

test("customer authentication shares a 10-request per-IP window and returns Retry-After", () => {
  const now = 1_000_000;
  const client = request("198.51.100.10, 203.0.113.9");

  for (let attempt = 0; attempt < 10; attempt += 1) {
    assert.equal(publicRateLimitResponse(client, "customer-auth", now), null);
  }

  const limited = publicRateLimitResponse(client, "customer-auth", now);
  assert.equal(limited?.status, 429);
  assert.equal(limited?.headers.get("Retry-After"), "900");
  assert.equal(limited?.headers.get("Cache-Control"), "private, no-store");
});

test("inquiry submissions use a separate per-IP window and expired windows reset", () => {
  const now = 2_000_000;
  const client = request("192.0.2.44");

  assert.equal(publicRateLimitResponse(client, "inquiries", now), null);
  assert.equal(publicRateLimitResponse(client, "customer-auth", now), null);
  assert.equal(publicRateLimitResponse(client, "inquiries", now + 15 * 60 * 1000), null);
});

test("invalid forwarded addresses share a fallback bucket", () => {
  const now = 3_000_000;
  const first = request("not-an-ip");
  const second = request("also-not-an-ip");

  for (let attempt = 0; attempt < 10; attempt += 1) {
    assert.equal(publicRateLimitResponse(first, "inquiries", now), null);
  }

  assert.equal(publicRateLimitResponse(second, "inquiries", now)?.status, 429);
});
