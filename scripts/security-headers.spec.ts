import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";

test("report-only CSP creates fresh nonces, replaces untrusted nonce headers and keeps HSTS opt-in", () => {
  const previous = process.env.HSTS_ENABLED;
  try {
    delete process.env.HSTS_ENABLED;
    const request = new NextRequest("https://synthetic.example.test/account", { headers: { "x-nonce": "attacker" } });
    const first = proxy(request), second = proxy(request);
    const nonce = first.headers.get("x-middleware-request-x-nonce");
    assert.match(nonce!, /^[A-Za-z0-9+/]{22}==$/);
    assert.notEqual(nonce, second.headers.get("x-middleware-request-x-nonce"));
    const policy = first.headers.get("Content-Security-Policy-Report-Only");
    assert.ok(policy?.includes(`'nonce-${nonce}'`));
    assert.equal(first.headers.get("Content-Security-Policy"), null);
    assert.equal(first.headers.get("Strict-Transport-Security"), null);
    process.env.HSTS_ENABLED = "true";
    assert.equal(proxy(request).headers.get("Strict-Transport-Security"), "max-age=300");
  } finally { if (previous === undefined) delete process.env.HSTS_ENABLED; else process.env.HSTS_ENABLED = previous; }
});
