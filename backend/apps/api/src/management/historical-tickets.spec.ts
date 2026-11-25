import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { historicalTickets, reviewHistoricalTickets } from "./historical-tickets";
import type { AuthUser } from "../auth/auth.types";

const admin = { id: "synthetic", isSuperAdmin: true } as AuthUser;
const staff = { ...admin, isSuperAdmin: false, permissions: ["ticket.view", "ticket.edit"] };
const sourceHash = "a".repeat(64), version = "2035-01-01T00:00:00.000Z";
const source = { supplier: "Synthetic supplier", currency: "PKR", statement_total: "12.34", tickets: [
  { ticket_number: "0000000000001", passenger: "Synthetic one", sector: "ISB-JED", statement_amount: "12.34", passport: "must never be returned" },
] };
const row = () => ({ id: "source-a", pnr: "ABC123", updatedAt: new Date(version), rawData: { historicalSupplierStatements: { [sourceHash]: source }, unrelated: { preserved: true } } });
const body = { sourceHash, version, note: "Needs invoice review", reason: "Reconciled source" };

test("scoped staff cannot read or edit unscoped historical source records", async () => {
  await assert.rejects(historicalTickets({} as never, staff), { status: 403 });
  await assert.rejects(reviewHistoricalTickets({} as never, staff, "source-a", body), { status: 403 });
});
test("historical projection exposes source ticket columns without raw data or private identifiers", async () => {
  const result = await historicalTickets({ pnrRecord: { findMany: async () => [row()] } } as never, admin);
  assert.equal(result.groups[0].statements[0].tickets[0].ticketNumber, "0000000000001");
  assert.equal(result.groups[0].statements[0].total, "12.34");
  assert.ok(!JSON.stringify(result).includes("passport"));
  assert.ok(!JSON.stringify(result).includes("unrelated"));
});
test("pagination preserves PNR groups and validates the cursor", async () => {
  let args: unknown;
  const result = await historicalTickets({ pnrRecord: { findMany: async (a: unknown) => { args = a; return Array.from({ length: 51 }, (_, i) => ({ ...row(), id: `row-${i}` })); } } } as never, admin, "row-0");
  assert.equal(result.groups.length, 50); assert.equal(result.nextCursor, "row-49");
  assert.match(JSON.stringify(args), /historicalSupplierStatements/);
  await assert.rejects(historicalTickets({} as never, admin, "../outside"), { status: 400 });
});
test("edits reject financial mass assignment, malformed versions and missing reason before writes", async () => {
  for (const change of [{ net: "0" }, { version: "invalid" }, { reason: " " }, { note: "x".repeat(2001) }, { sourceHash: "__proto__" }]) {
    await assert.rejects(reviewHistoricalTickets({} as never, admin, "source-a", { ...body, ...change }), { status: 400 });
  }
});
test("review edits preserve immutable source and other metadata and audit the actual actor", async () => {
  let changed: Record<string, unknown> = {}, audit: Record<string, unknown> = {};
  const tx = { pnrRecord: { findUnique: async () => row(), updateMany: async ({ data }: { data: Record<string, unknown> }) => { changed = data; return { count: 1 }; } },
    auditLog: { create: async ({ data }: { data: Record<string, unknown> }) => { audit = data; } } };
  await reviewHistoricalTickets({ $transaction: async (fn: (v: unknown) => unknown) => fn(tx) } as never, admin, "source-a", body);
  const raw = changed.rawData as ReturnType<typeof row>["rawData"] & { historicalSupplierReviews: Record<string, { note: string }> };
  assert.deepEqual(raw.historicalSupplierStatements[sourceHash], source);
  assert.deepEqual(raw.unrelated, { preserved: true });
  assert.equal(raw.historicalSupplierReviews[sourceHash].note, body.note);
  assert.equal(audit.userId, admin.id); assert.equal(audit.reason, body.reason);
  assert.ok((changed.updatedAt as Date).getTime() > new Date(version).getTime());
});
test("stale versions and concurrent claims never overwrite reviews or add audits", async () => {
  for (const stale of [true, false]) {
    let audited = false;
    const tx = { pnrRecord: { findUnique: async () => ({ ...row(), updatedAt: new Date(stale ? "2035-01-02" : version) }), updateMany: async () => ({ count: 0 }) },
      auditLog: { create: async () => { audited = true; } } };
    await assert.rejects(reviewHistoricalTickets({ $transaction: async (fn: (v: unknown) => unknown) => fn(tx) } as never, admin, "source-a", body), { status: 409 });
    assert.equal(audited, false);
  }
});
