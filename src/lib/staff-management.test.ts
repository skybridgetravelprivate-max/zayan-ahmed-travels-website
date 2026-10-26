import assert from "node:assert/strict";
import { test } from "node:test";
import { formPayload, displayValue, rowLabel, staffConflictMessage } from "./staff-management";
import { workflowsFor, STAFF_WORKFLOWS } from "./staff-workflows";

test("accounting-review conflict has a fixed safe message; arbitrary server details are withheld", () => {
  assert.match(staffConflictMessage({ code: "UMRAH_CANCELLATION_REVIEW_REQUIRED", message: "private fixture" }), /Cancellation requires accounting review/);
  for (const body of [null, [], "private fixture", { message: "private fixture" }, { code: "UNKNOWN", message: "private fixture" }]) {
    assert.equal(staffConflictMessage(body), "The record changed or conflicts with an existing record. Reload and review before saving.");
  }
});

test("form serialization sends only declared fields and preserves explicit clearing", () => {
  const form = new FormData();
  form.set("name", "Synthetic"); form.set("email", ""); form.set("admin", "true");
  const fields = [{ name: "name", label: "Name", type: "String", nullable: false, required: true }, { name: "email", label: "Email", type: "String", nullable: true, required: false }];
  assert.deepEqual(formPayload(fields, form, false), { name: "Synthetic", email: null });
  assert.deepEqual(formPayload(fields, form, true), { name: "Synthetic" });
});
test("display excludes nested secrets and workflow availability follows permissions", () => {
  assert.equal(displayValue({ passwordHash: "secret" }), "—");
  assert.equal(rowLabel({ id: "one", version: null, fullName: "Synthetic" }), "Synthetic");
  assert.equal(rowLabel({ id: "request_internal", version: null, receiptNo: "ZAT-REC-1" }), "ZAT-REC-1");
  assert.equal(workflowsFor("tickets", true, ["ticket.view"], false).length, 0);
  assert.equal(workflowsFor("tickets", true, ["ticket.refund"], false)[0].key, "refund");
  assert.equal(workflowsFor("payments", false, ["account.post"], false).length, 0);
  assert.equal(workflowsFor("payments", false, [], true).length, 1);
  for (const actions of Object.values(STAFF_WORKFLOWS)) for (const a of actions) assert.match(a.path, /^\/api\/v1\/[a-z/-]+(?::id)?[a-z/-]*$/);
});
