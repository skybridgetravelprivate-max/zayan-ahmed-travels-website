import assert from "node:assert/strict";
import { test } from "node:test";
import { businessDay } from "./business-day";

test("CRM day uses configured Karachi midnight even when UTC date differs", () => {
  const day = businessDay("Asia/Karachi", new Date("2026-10-29T20:30:00Z"));
  assert.equal(day.start.toISOString(), "2026-10-29T19:00:00.000Z");
  assert.equal(day.endExclusive.toISOString(), "2026-10-30T19:00:00.000Z");
});
test("CRM calendar day follows 23/25-hour DST boundaries", () => {
  for (const [date, hours] of [["2026-03-08T12:00:00Z", 23], ["2026-11-01T12:00:00Z", 25]] as const) {
    const day = businessDay("America/New_York", new Date(date));
    assert.equal((+day.endExclusive - +day.start) / 3600000, hours);
  }
  assert.throws(() => businessDay("invalid/synthetic"), RangeError);
});
