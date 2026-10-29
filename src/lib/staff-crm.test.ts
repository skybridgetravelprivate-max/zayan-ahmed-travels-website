import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCrmQueue } from "./staff-crm";
const queue = () => ({ timeZone: "Asia/Karachi", access: { followUps: true, tasks: true, quotations: false }, overdueFollowUps: [{ id: "follow-1", subject: "Call the customer", dueAt: "2026-10-29T08:00:00Z", customer: { fullName: "Synthetic customer" } }], todayFollowUps: [], tasksDue: [], newLeads: [], openQuotes: [], expiringQuotes: [] });
test("staff queue projects only authorized display fields and preserves customer-only work", () => {
  const body = queue();
  const result = parseCrmQueue(body)!;
  assert.equal(result.groups[0].items[0].owner, "Synthetic customer");
  assert.equal(result.groups[0].resource, "follow-ups");
  assert.equal(result.groups[4].allowed, false);
  assert.equal(JSON.stringify(result).includes("access"), false);
});
test("restricted groups are hidden even if a response unexpectedly contains rows", () => {
  const body = queue(); body.access.followUps = false;
  assert.deepEqual(parseCrmQueue(body)?.groups[0].items, []);
});
test("malformed queue, unsafe ids, invalid zones/dates and unbounded results fail closed", () => {
  for (const mutate of [
    (q: ReturnType<typeof queue>) => { q.timeZone = "unknown/timezone"; },
    (q: ReturnType<typeof queue>) => { q.overdueFollowUps[0].id = "../foreign"; },
    (q: ReturnType<typeof queue>) => { q.overdueFollowUps[0].dueAt = "invalid-date"; },
    (q: ReturnType<typeof queue>) => { q.overdueFollowUps = Array(31).fill(q.overdueFollowUps[0]); },
  ]) { const q = queue(); mutate(q); assert.equal(parseCrmQueue(q), null); }
  assert.equal(parseCrmQueue({}), null);
});
