import assert from "node:assert/strict";
import { test } from "node:test";
import { getStaffIdentity } from "./staff-api";
import { staffLoginFailureMessage, staffLoginValidationMessage } from "../lib/staff-login";

test("staff sign-in validates UTF-8 bytes without trimming or truncating passwords", () => {
  for (const password of ["a".repeat(72), "é".repeat(36), "😀".repeat(18), " legacy password "]) {
    assert.equal(staffLoginValidationMessage("staff", password), null);
  }
  for (const password of ["a".repeat(73), "é".repeat(37), "😀".repeat(19), "a".repeat(72) + " "]) {
    assert.match(staffLoginValidationMessage("staff", password)!, /72 UTF-8 byte limit/);
  }
  assert.ok(staffLoginValidationMessage(" ", "password"));
  assert.ok(staffLoginValidationMessage("staff", ""));
  assert.ok(staffLoginValidationMessage("a".repeat(255), "password"));
  assert.equal(staffLoginValidationMessage(" staff ", "short"), null);
});

test("invalid login fields are distinguished from an outage without revealing account details", () => {
  assert.match(staffLoginFailureMessage(400), /Check your sign-in fields/);
  assert.doesNotMatch(staffLoginFailureMessage(400), /temporarily unavailable/);
  assert.match(staffLoginFailureMessage(401), /Sign-in failed/);
  assert.match(staffLoginFailureMessage(429), /Too many attempts/);
  for (const status of [403, 500, 502, 503]) assert.match(staffLoginFailureMessage(status), /temporarily unavailable/);
});

test("staff identity fails closed for missing, expired and unavailable authentication", async () => {
  assert.equal((await getStaffIdentity(async () => null)).status, "signed-out");
  assert.equal((await getStaffIdentity(async () => new Response(null, { status: 401 }))).status, "signed-out");
  assert.equal((await getStaffIdentity(async () => new Response(null, { status: 503 }))).status, "unavailable");
  assert.equal((await getStaffIdentity(async () => Response.json({ ok: true, customer: {} }))).status, "unavailable");
  assert.equal((await getStaffIdentity(async () => { throw new Error("private backend detail"); })).status, "unavailable");
});

test("staff identity uses only validated backend identity and permission fields", async () => {
  const result = await getStaffIdentity(async () => Response.json({ fullName: "Staff", username: "staff", roleNames: ["Employee"], permissions: [], isSuperAdmin: false, passwordHash: "must-not-escape" }));
  assert.deepEqual(result, { status: "authenticated", user: { fullName: "Staff", username: "staff", roleNames: ["Employee"], permissions: [], isSuperAdmin: false } });
});
