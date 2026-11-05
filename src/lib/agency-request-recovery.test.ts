import assert from "node:assert/strict";
import test from "node:test";
import { clearAgencyRequest, parseAgencyRequestDraft, reserveAgencyRequest } from "./agency-request-recovery";

function fixture() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
const details = { kind: "ENQUIRY", subject: "Synthetic request", message: "Please review synthetic package options." };

test("reload and a second tab reuse the durable saved identity", () => {
  const storage = fixture();
  const first = reserveAgencyRequest(storage, "agency:user", details, () => "synthetic-key-0001");
  const second = reserveAgencyRequest(storage, "agency:user", { ...details, subject: "Changed in another tab" }, () => "synthetic-key-0002");
  assert.deepEqual(second, first);
  assert.deepEqual(parseAgencyRequestDraft(storage.getItem("agency:user")), first);
});

test("late responses cannot remove a newer request", () => {
  const storage = fixture();
  reserveAgencyRequest(storage, "agency:user", details, () => "synthetic-key-0002");
  clearAgencyRequest(storage, "agency:user", "synthetic-key-0001");
  assert.ok(storage.getItem("agency:user"));
  clearAgencyRequest(storage, "agency:user", "synthetic-key-0002");
  assert.equal(storage.getItem("agency:user"), null);
});

test("reviewed equal submissions can use distinct identities", () => {
  const storage = fixture();
  const first = reserveAgencyRequest(storage, "agency:user", details, () => "synthetic-key-0001");
  clearAgencyRequest(storage, "agency:user", first.key);
  const next = reserveAgencyRequest(storage, "agency:user", details, () => "synthetic-key-0002");
  assert.notEqual(first.key, next.key);
});

test("malformed or unavailable recovery storage fails closed", () => {
  for (const raw of ["not JSON", "null", JSON.stringify({ ...details, key: "short" }), JSON.stringify({ ...details, key: "synthetic-key-0001", kind: "REFUND_PAYOUT" })]) {
    assert.throws(() => parseAgencyRequestDraft(raw));
  }
  assert.throws(() => reserveAgencyRequest({ getItem: () => null, setItem: () => {} }, "agency:user", details, () => "synthetic-key-0001"));
});

test("separate users and agencies have separate pending submissions", () => {
  const storage = fixture();
  reserveAgencyRequest(storage, "agency-a:user-a", details, () => "synthetic-key-0001");
  assert.equal(storage.getItem("agency-b:user-b"), null);
});
