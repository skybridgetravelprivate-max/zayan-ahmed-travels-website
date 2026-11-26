import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { dailyOperations } from "./daily-operations";
import type { AuthUser } from "../auth/auth.types";

test("daily operations uses the company calendar and branch scope for every permitted service", async () => {
  const calls: unknown[] = [];
  const count = async (args: unknown) => { calls.push(args); return 2; };
  const db = { companySettings: { findFirst: async () => ({ timezone: "Asia/Karachi" }) }, hotelBooking: { count }, ticketSale: { count }, transportBooking: { count } };
  const user = { isSuperAdmin: false, id: "synthetic", branchIds: ["branch-a"], permissions: ["reservation.view", "ticket.view", "transport.view"] } as AuthUser;
  const result = await dailyOperations(db as never, user, new Date("2035-01-01T20:00:00Z"));
  assert.equal(result.period.start.toISOString(), "2035-01-01T19:00:00.000Z");
  assert.equal(result.period.endExclusive.toISOString(), "2035-01-02T19:00:00.000Z");
  assert.equal(calls.length, 4);
  for (const call of calls) assert.match(JSON.stringify(call), /branch-a/);
  assert.ok(result.metrics.every(m => m.value === 2));
  assert.match(JSON.stringify(calls[2]), /ISSUED/);
  assert.match(JSON.stringify(calls[3]), /CANCELLED/);
});
test("daily operations does not query or disclose service counts without their view permissions", async () => {
  const db = { companySettings: { findFirst: async () => ({ timezone: "Asia/Karachi" }) } };
  const user = { isSuperAdmin: false, permissions: ["dashboard.view"], branchIds: [] } as unknown as AuthUser;
  const result = await dailyOperations(db as never, user);
  assert.ok(result.metrics.every(m => m.value === null));
});
