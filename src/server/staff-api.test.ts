import assert from "node:assert/strict";
import { test } from "node:test";
import { getStaffIdentity } from "./staff-api";

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
