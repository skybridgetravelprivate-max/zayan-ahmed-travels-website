import assert from "node:assert/strict";
import { test } from "node:test";
import { clearReceiptRetry, hasPendingReceipt, receiptRetryKey } from "./receipt-retry";

function storage() {
  const rows = new Map<string, string>();
  return { rows, getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key, value); }, removeItem: (key: string) => { rows.delete(key); } };
}

test("receipt key survives a reload and reordered fields without storing payment data", async () => {
  const session = storage();
  const key = await receiptRetryKey(session, "staff", { bookingId: "private-booking", amount: 100, method: "CASH" });
  // A new module/component instance reads the same session storage after reload.
  assert.equal(await receiptRetryKey(session, "staff", { method: "CASH", amount: 100, bookingId: "private-booking" }), key);
  assert.equal(hasPendingReceipt(session, "staff"), true);
  assert.ok(!JSON.stringify([...session.rows]).includes("private-booking"));
  assert.ok(!JSON.stringify([...session.rows]).includes("CASH"));
});

test("uncertain receipt blocks changed payloads until history review; staff namespaces stay separate", async () => {
  const session = storage();
  const key = await receiptRetryKey(session, "staff", { amount: 100 });
  await assert.rejects(receiptRetryKey(session, "staff", { amount: 101 }), /earlier receipt is unconfirmed/);
  assert.notEqual(await receiptRetryKey(session, "other", { amount: 101 }), key);
  clearReceiptRetry(session, "staff");
  assert.equal(hasPendingReceipt(session, "staff"), false);
  assert.notEqual(await receiptRetryKey(session, "staff", { amount: 100 }), key);
});

test("receipt storage failures or corruption fail before submission, without replacing the prior key", async () => {
  const session = storage();
  const key = await receiptRetryKey(session, "staff", { amount: 100 });
  const storageKey = [...session.rows.keys()][0];
  session.rows.set(storageKey, "broken");
  await assert.rejects(receiptRetryKey(session, "staff", { amount: 100 }), /retry information is unavailable/);
  assert.equal(session.rows.get(storageKey), "broken");
  assert.ok(key);
  await assert.rejects(receiptRetryKey({ ...session, setItem: () => { throw Error("storage disabled"); } }, "new-staff", { amount: 100 }), /storage disabled/);
});
