import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { WorkflowsController } from "../workflows/workflows.controller";
import { UmrahOpsService } from "../umrah/umrah-ops.service";
import type { AuthUser } from "../auth/auth.types";

const user: AuthUser = { id: "synthetic-user", email: "synthetic@example.invalid", username: "synthetic", fullName: "Synthetic", isSuperAdmin: false, branchIds: ["a"], defaultBranchId: "a", roleNames: [], permissions: ["ticket.create", "transport.create", "umrah.create"] };
const req = { user } as never;

function harness(failCost = false) {
  const state = { records: [] as unknown[], journals: [] as unknown[], audits: [] as unknown[], vouchers: [] as unknown[] };
  const tx = {
    customer: { findUnique: async () => ({ id: "customer-a", branchId: "a", leadId: null }) },
    ticketSale: { create: async ({ data }: { data: object }) => { const row = { id: "ticket-a", ...data }; state.records.push(row); return row; } },
    transportBooking: { create: async ({ data }: { data: object }) => { const row = { id: "transport-a", ...data }; state.records.push(row); return row; } },
    transportVoucher: { create: async (data: unknown) => { state.vouchers.push(data); return {}; } },
    umrahBooking: { create: async ({ data }: { data: object }) => { const row = { id: "umrah-a", ...data }; state.records.push(row); return row; }, findUnique: async () => state.records[0] },
  };
  const prisma = { $transaction: async (run: (db: typeof tx) => Promise<unknown>, options: { isolationLevel: string }) => {
    assert.equal(options.isolationLevel, "Serializable");
    const snapshot = structuredClone(state);
    try { return await run(tx); } catch (e) { Object.assign(state, snapshot); throw e; }
  } };
  const seq = { next: async (_key: string, _prefix: string, db: unknown) => { assert.equal(db, tx); return "SYNTHETIC-001"; } };
  const audit = { log: async (entry: { db: unknown }) => { assert.equal(entry.db, tx); state.audits.push(entry); } };
  const post = async (entry: { db: unknown; kind?: string; module?: string }) => {
    assert.equal(entry.db, tx);
    if (failCost && entry.kind === "COST") throw new Error("synthetic ledger failure");
    state.journals.push(entry);
    return { id: "journal-a" };
  };
  const accounting = { accountByCode: async (code: string, db: unknown) => { assert.equal(db, tx); return { id: code }; }, postJournal: post, postSale: async (entry: { db: unknown }) => post({ ...entry, kind: "SALE" }), postCost: async (entry: { db: unknown }) => post({ ...entry, kind: "COST" }) };
  return { state, controller: new WorkflowsController(prisma as never, seq as never, audit as never, accounting as never, {} as never), umrah: new UmrahOpsService(prisma as never, seq as never, audit as never, accounting as never) };
}

test("ticket issue posts sale, cost and audit in one transaction and derives payment state", async () => {
  const h = harness();
  const result = await h.controller.sellTicket({ ticketNumber: "SYNTHETIC-TICKET", customerId: "customer-a", fare: 100, cost: 60, paidAmount: 100 }, req);
  assert.equal(result.branchId, "a");
  assert.equal(result.paymentStatus, "PAID");
  assert.equal(h.state.journals.length, 2);
  assert.equal(h.state.audits.length, 1);
});
test("failed ticket cost journal rolls back its ticket and sale journal", async () => {
  const h = harness(true);
  await assert.rejects(h.controller.sellTicket({ fare: 100, cost: 60 }, req), /synthetic ledger failure/);
  assert.equal(h.state.records.length, 0);
  assert.equal(h.state.journals.length, 0);
});
test("invalid ticket amounts and protected fields are rejected before insertion", async () => {
  for (const body of [{ fare: -1 }, { fare: 10, paidAmount: 11 }, { fare: 10, id: "forged" }, { fare: "NaN" }, { fare: 10, customer: { create: { fullName: "nested" } } }]) {
    const h = harness();
    await assert.rejects(h.controller.sellTicket(body, req));
    assert.equal(h.state.records.length, 0);
  }
});
test("transport creation commits voucher and both journals together; ledger failure rolls back", async () => {
  const body = { customerId: "customer-a", sellingPrice: 100, cost: 50, tripDate: "2026-10-19T00:00:00Z", paxCount: 1 };
  const ok = harness();
  await ok.controller.sellTransport(body, req);
  assert.equal(ok.state.records.length, 1);
  assert.equal(ok.state.vouchers.length, 1);
  assert.equal(ok.state.journals.length, 2);
  const failed = harness(true);
  await assert.rejects(failed.controller.sellTransport(body, req));
  assert.equal(failed.state.records.length, 0);
  assert.equal(failed.state.vouchers.length, 0);
  assert.equal(failed.state.journals.length, 0);
});
test("Umrah creation passes the transaction through number, ledger and audit operations", async () => {
  const body = { customerId: "customer-a", cost: 50, sellingPrice: 100 };
  const ok = harness();
  await ok.umrah.save(user, body);
  assert.equal(ok.state.records.length, 1);
  assert.equal(ok.state.journals.length, 2);
  assert.equal(ok.state.audits.length, 1);
  const failed = harness(true);
  await assert.rejects(failed.umrah.save(user, body));
  assert.equal(failed.state.records.length, 0);
  assert.equal(failed.state.journals.length, 0);
});
