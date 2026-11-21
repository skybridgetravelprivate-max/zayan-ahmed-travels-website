import assert from "node:assert/strict";
import test from "node:test";
import {
  canStartNewQuotation,
  releaseQuotationKey,
  savedQuotationAttempts,
} from "./communication-recovery";

function storage() {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}
const name = "zat:pending-receipt:alice:quotation-send:quote-1";
test("quotation recovery lists only the authenticated staff namespace and keeps corrupt entries intact", () => {
  const s = storage();
  s.setItem(
    name,
    JSON.stringify({ key: "original-request-key", fingerprint: "synthetic" }),
  );
  s.setItem(
    "zat:pending-receipt:bob:quotation-send:quote-2",
    JSON.stringify({ key: "other-request-key" }),
  );
  assert.deepEqual(savedQuotationAttempts(s, "alice"), [
    {
      identity: "alice:quotation-send:quote-1",
      recordId: "quote-1",
      key: "original-request-key",
    },
  ]);
  s.setItem(name, "corrupt");
  assert.throws(() => savedQuotationAttempts(s, "alice"));
  assert.equal(s.getItem(name), "corrupt");
});
test("new quotation intent is blocked for accepted, uncertain and wholly unknown results", () => {
  assert.equal(canStartNewQuotation(["NOT_SENT", "MISSING"]), true);
  assert.equal(canStartNewQuotation(["NOT_SENT", "NOT_SENT"]), true);
  for (const states of [
    ["NOT_SENT", "SENT"],
    ["NOT_SENT", "UNCERTAIN"],
    ["MISSING", "MISSING"],
    ["NOT_SENT"],
  ])
    assert.equal(canStartNewQuotation(states as never), false);
});
test("reviewed key release preserves concurrent replacements and unrelated receipt keys", () => {
  const s = storage();
  s.setItem(name, JSON.stringify({ key: "original-request-key" }));
  s.setItem("zat:pending-receipt:alice", "unrelated-receipt");
  assert.throws(() =>
    releaseQuotationKey(
      s,
      "alice:quotation-send:quote-1",
      "original-request-key",
      ["SENT", "NOT_SENT"],
    ),
  );
  s.setItem(name, JSON.stringify({ key: "replacement-request-key" }));
  assert.throws(() =>
    releaseQuotationKey(
      s,
      "alice:quotation-send:quote-1",
      "original-request-key",
      ["NOT_SENT", "MISSING"],
    ),
  );
  assert.ok(s.getItem(name)?.includes("replacement-request-key"));
  releaseQuotationKey(
    s,
    "alice:quotation-send:quote-1",
    "replacement-request-key",
    ["NOT_SENT", "MISSING"],
  );
  assert.equal(s.getItem(name), null);
  assert.equal(s.getItem("zat:pending-receipt:alice"), "unrelated-receipt");
});
