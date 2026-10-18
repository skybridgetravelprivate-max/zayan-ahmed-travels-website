import assert from "node:assert/strict";
import { test } from "node:test";
import { ResourcesService } from "../resources/resources.service";
import { PeopleOcrService } from "../crm/people-ocr.service";
import { DocumentsController, PdfController } from "../documents/documents.controller";
import { WorkflowsController } from "../workflows/workflows.controller";
import { ReservationService } from "../reservation/reservation.service";
import { AccountingService } from "../finance/accounting.service";
import { Prisma } from "@prisma/client";
import { AuthUser } from "../auth/auth.types";
const user: AuthUser = { id: "staff", email: "a@test", username: "a", fullName: "A", permissions: ["passenger.view", "passenger.create", "passenger.edit", "passenger.delete", "document.view", "hotel.booking", "reservation.cancel"], roleNames: [], branchIds: ["a"], defaultBranchId: null, isSuperAdmin: false };
const req = (u = user) => ({ user: u }) as never;
const audit = { log: async () => {} };

test("passenger CRUD scopes lists and rejects foreign records, attachment, reassignment and unowned records", async () => {
  let writes = 0;
  const db = { customer: { findUnique: async ({ where }: { where: { id: string; code?: string; customer?: unknown } }) => ({ branchId: where.id }) }, passenger: {
    findMany: async ({ where }: { where: { customer: unknown } }) => { assert.deepEqual(where.customer, { branchId: { in: ["a"] }, AND: [{ OR: [{ leadId: null }, { lead: { branchId: { in: ["a"] } } }] }] }); return []; }, count: async () => 0,
    findUnique: async ({ where }: { where: { id: string; code?: string; customer?: unknown } }) => ({ id: where.id, customerId: where.id === "orphan" ? null : where.id }),
    create: async () => { writes++; return {}; }, update: async () => { writes++; return {}; }, delete: async () => { writes++; },
  } };
  const svc = new ResourcesService(db as never, {} as never, audit as never);
  await svc.list("passengers", user, { customerId: "b" });
  for (const id of ["b", "orphan"]) {
    await assert.rejects(svc.get("passengers", id, user), { status: 404 });
    await assert.rejects(svc.update("passengers", id, user, {}), { status: 404 });
    await assert.rejects(svc.remove("passengers", id, user), { status: 404 });
  }
  await assert.rejects(svc.create("passengers", user, { customerId: "b" }), { status: 404 });
  await assert.rejects(svc.update("passengers", "a", user, { customerId: "b" }), { status: 404 });
  await assert.rejects(svc.update("passengers", "a", user, { customerId: null }), { status: 404 });
  assert.equal(writes, 0);
  await svc.create("passengers", user, { customerId: "a" });
  assert.equal(writes, 1);
});

test("OCR authorizes the target entity permission and customer branch before writes", async () => {
  const svc = new PeopleOcrService({ ocrExtract: { findUnique: async () => ({ parsed: {} }) }, customer: { findUnique: async () => ({ branchId: "b" }) }, passenger: { findUnique: async () => ({ customerId: "b" }) } } as never, audit as never);
  await assert.rejects(svc.confirm(user, { extractId: "x", customerId: "b" }), { status: 403 });
  await assert.rejects(svc.confirm({ ...user, permissions: ["customer.edit"] }, { extractId: "x", customerId: "b" }), { status: 404 });
  await assert.rejects(svc.confirm(user, { extractId: "x", passengerId: "b" }), { status: 404 });
  await assert.rejects(svc.confirm(user, { extractId: "x", customerId: "a", passengerId: "b" }), { status: 400 });
});

test("downloads and every sensitive PDF resolve owner authorization before reading storage or rendering", async () => {
  let reads = 0;
  const db: Record<string, { findUnique: () => Promise<Record<string, unknown>> }> = { storedDocument: { findUnique: async () => ({ entityType: "customer", entityId: "b", uploadedById: user.id }) }, customer: { findUnique: async () => ({ branchId: "b" }) } };
  const ctrl = new DocumentsController(
    db as never,
    { get: async () => { reads++; } } as never,
    {} as never,
  );
  await assert.rejects(ctrl.download("doc", {} as never, req({ ...user, permissions: [...user.permissions, "customer.view"] })), { status: 404 });
  const pdf = new PdfController(db as never, { pipeA4: () => { reads++; } } as never);
  await assert.rejects(pdf.salary("salary", "", {} as never, req()), { status: 403 });
  for (const [method, model, permission] of [["quotation", "quotation", "quotation"], ["umrahBooking", "umrahBooking", "booking"], ["hotelReservation", "hotelBooking", "hotel"], ["ticketInvoice", "ticketSale", "ticket"], ["receipt", "receipt", "account"], ["serviceInvoice", "serviceInvoice", "account"]]) {
    db[model] = { findUnique: async () => ({ branchId: "b" }) };
    await assert.rejects((pdf as unknown as Record<string, (id: string, mode: string, res: unknown, request: unknown) => Promise<unknown>>)[method]("b", "", {}, req({ ...user, permissions: [permission + ".view"] })), { status: 404 });
  }
  assert.equal(reads, 0);
});

test("foreign lead and quotation conversion stop before sequences, customer, booking or journal writes", async () => {
  const db = { lead: { findUnique: async () => ({ branchId: "b" }) }, quotation: { findUnique: async () => ({ branchId: "b", customerId: "b" }) } };
  const ctrl = new WorkflowsController(db as never, {} as never, audit as never, {} as never, {} as never);
  await assert.rejects(ctrl.convertLead("b", req()), { status: 404 });
  await assert.rejects(ctrl.convertQuote("b", req()), { status: 404 });
});

// No database access: model transaction rollback and lock scheduling, while asserting
// the controller issues the PostgreSQL row lock before reading availability.
function refundsHarness(fail = false) {
  let state = { refunds: [] as { netRefund: number }[], journals: [] as Record<string, unknown>[], status: "ISSUED" };
  let tail = Promise.resolve();
  const prisma = { $transaction: async (run: (tx: unknown) => Promise<unknown>) => {
    let release!: () => void;
    const before = tail; tail = new Promise<void>(r => { release = r; });
    let draft: typeof state; let locked = false;
    const tx = { $queryRaw: async (sql: TemplateStringsArray, id: string) => { assert.match(sql.join("?"), /TicketSale.*FOR UPDATE/); assert.equal(id, "t"); await before; locked = true; draft = structuredClone(state); },
      ticketSale: { findUnique: async () => { assert.ok(locked); return { id: "t", branchId: "a", net: 100, paidAmount: 100, paymentStatus: "PAID", status: draft.status, refunds: draft.refunds }; }, update: async ({ data }: { data: Record<string, unknown> }) => { draft.status = String(data.status); } },
      ticketRefund: { create: async ({ data }: { data: Record<string, unknown> }) => { if (fail) throw Error("injected insert failure"); draft.refunds.push(data as { netRefund: number }); return data; } },
      chartOfAccount: { findUnique: async ({ where }: { where: { id: string; code?: string; customer?: unknown } }) => ({ id: where.code }) },
      journalEntry: { create: async ({ data }: { data: Record<string, unknown> }) => { draft.journals.push(data); return { id: "j", ...data }; } },
      numberSequence: { upsert: async () => ({ current: 1, padLength: 1 }) },
    };
    try { const result = await run(tx); state = draft!; return result; } finally { release(); }
  } };
  const seq = { next: async (_k: string, _p: string, tx: Prisma.TransactionClient) => { assert.ok(tx.journalEntry); return "J1"; } };
  const accounting = new AccountingService(prisma as never, seq as never, audit as never);
  const ctrl = new WorkflowsController(prisma as never, {} as never, audit as never, accounting, {} as never);
  return { ctrl, state: () => state };
}
test("two concurrent full refunds commit only the available amount", async () => {
  const h = refundsHarness();
  const results = await Promise.allSettled([1, 2].map(() => h.ctrl.refund("t", { refundAmount: 100, reason: "test" }, req())));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(h.state().refunds.reduce((s, r) => s + r.netRefund, 0), 100);
  assert.equal(h.state().journals.length, 1);
  assert.equal(h.state().status, "REFUNDED");
});
test("failure after refund journal insertion rolls back all refund changes", async () => {
  const h = refundsHarness(true);
  await assert.rejects(h.ctrl.refund("t", { refundAmount: 100, reason: "test" }, req()), /injected/);
  assert.deepEqual(h.state(), { refunds: [], journals: [], status: "ISSUED" });
});

test("posted reservation edits reject changed amounts or parties before writes", async () => {
  const existing = { cost: 50, sellingPrice: 100, discount: 0, tax: 0, commission: 0, net: 100, paid: 0, customerId: "a", supplierId: "s", branchId: "a" };
  const tx = { $queryRaw: async () => [], hotelStayRoom: { findMany: async () => [] }, hotelBooking: { findUnique: async () => existing } };
  const svc = new ReservationService({ $transaction: async (run: (tx: unknown) => Promise<unknown>) => run(tx) } as never, {} as never, audit as never, {} as never);
  const input = { id: "r", customerId: "a", segments: [{ hotelId: "h", checkIn: "2026-12-01", checkOut: "2026-12-02", rooms: [{ sellingPrice: 100, supplierCost: 50 }] }] };
  for (const patch of [{ customerId: "b" }, { supplierId: "other" }, { segments: [{ ...input.segments[0], rooms: [{ sellingPrice: 200, supplierCost: 50 }] }] }, { segments: [{ ...input.segments[0], rooms: [{ sellingPrice: 100, supplierCost: 60 }] }] }]) {
    await assert.rejects(svc.save(user, { ...input, ...patch }), /Posted reservation/);
  }
});

test("reservation cancellation offsets sale and cost atomically and rollback preserves original", async () => {
  for (const fail of [false, true]) {
    let committed = { cancelled: false, offsets: [] as { debit: number; credit: number }[][] };
    const booking = { branchId: "a", paid: 0, staySegments: [], cancelledAt: null };
    const journals = [100, 50].map((n, i) => ({ entryNumber: "J" + i, lines: [{ accountId: "a" + i, debit: n, credit: 0, partyType: "customer", partyId: "a" }, { accountId: "b" + i, debit: 0, credit: n }] }));
    const prisma = { $transaction: async (run: (tx: unknown) => Promise<unknown>) => {
      const draft = structuredClone(committed);
      const tx = { $queryRaw: async (sql: TemplateStringsArray) => { assert.match(sql.join("?"), /HotelBooking.*FOR UPDATE/); }, hotelBooking: { findUnique: async () => booking, update: async () => { if (fail) throw Error("injected update failure"); draft.cancelled = true; return {}; } }, journalEntry: { findMany: async () => journals }, offsets: draft.offsets };
      const result = await run(tx); committed = draft; return result;
    } };
    const accounting = { postJournal: async (input: { db: { offsets: { debit: number; credit: number }[][] }; lines: { debit: number; credit: number }[] }) => { input.db.offsets.push(input.lines); } };
    const svc = new ReservationService(prisma as never, {} as never, audit as never, accounting as never);
    if (fail) { await assert.rejects(svc.cancel(user, "r", "test"), /injected/); assert.deepEqual(committed, { cancelled: false, offsets: [] }); }
    else { await svc.cancel(user, "r", "test"); assert.equal(committed.cancelled, true); assert.equal(committed.offsets.length, 2); committed.offsets.forEach((lines, i) => lines.forEach((line, j) => { assert.equal(line.debit, journals[i].lines[j].credit); assert.equal(line.credit, journals[i].lines[j].debit); })); }
  }
});

test("same-branch OCR confirmation accepts customer editors without passenger.edit", async () => {
  let writes = 0;
  const svc = new PeopleOcrService({
    ocrExtract: { findUnique: async () => ({ id: "x", parsed: { name: "New" } }), update: async () => ({}) },
    customer: { findUnique: async () => ({ id: "a", branchId: "a", fullName: "Old" }), update: async ({ data }: { data: Record<string, unknown> }) => { writes++; return data; } },
  } as never, audit as never);
  assert.deepEqual(await svc.confirm({ ...user, permissions: ["customer.edit"] }, { extractId: "x", customerId: "a", overwriteFields: ["fullName"] }), { fullName: "New" });
  assert.equal(writes, 1);
});

test("voucher ownership and PDF aliases inherit parent branch checks; HR viewers can render salary", async () => {
  let rendered = 0;
  const db: Record<string, { findUnique: () => Promise<Record<string, unknown>> }> = {
    hotelVoucher: { findUnique: async () => ({ bookingId: "b" }) }, hotelBooking: { findUnique: async () => ({ branchId: "b" }) },
    transportVoucher: { findUnique: async () => ({ bookingId: "b" }) }, transportBooking: { findUnique: async () => ({ branchId: "b" }) },
    ticketRefund: { findUnique: async () => ({ ticketId: "b" }) }, ticketSale: { findUnique: async () => ({ branchId: "b" }) },
    umrahBooking: { findUnique: async () => ({ branchId: "b" }) },
    salarySlip: { findUnique: async () => ({ slipNo: "S", employee: {} }) },
  };
  const pdf = new PdfController(db as never, { parseMode: () => "INCLUDED", pipeA4: () => { rendered++; } } as never);
  for (const [method, permission] of [["hotelVoucher", "hotel"], ["transportVoucher", "transport"], ["ticketRefund", "ticket"], ["umrahVoucher", "booking"], ["invoice", "booking"]]) {
    await assert.rejects((pdf as unknown as Record<string, (id: string, mode: string, res: unknown, request: unknown) => Promise<unknown>>)[method]("b", "", {}, req({ ...user, permissions: [permission + ".view"] })), { status: 404 });
  }
  await pdf.salary("s", "", {} as never, req({ ...user, permissions: ["document.view", "hr.view"] }));
  assert.equal(rendered, 1);
});

test("partial refunds stay active until the remaining amount is exhausted", async () => {
  const h = refundsHarness();
  for (const amount of [60, 20]) await h.ctrl.refund("t", { refundAmount: amount, reason: "test" }, req());
  assert.equal(h.state().status, "ISSUED");
  await h.ctrl.refund("t", { refundAmount: 20, reason: "test" }, req());
  assert.equal(h.state().status, "REFUNDED");
  assert.equal(h.state().refunds.reduce((sum, r) => sum + r.netRefund, 0), 100);
});

test("generic booking updates and deletion cannot bypass posted reservation protection", async () => {
  const svc = new ResourcesService({ hotelBooking: { findUnique: async () => ({ id: "r", branchId: "a" }) }, journalEntry: { findFirst: async () => ({ id: "j" }) } } as never, {} as never, audit as never);
  const editor = { ...user, permissions: ["hotel.edit", "hotel.delete"] };
  await assert.rejects(svc.update("hotel-bookings", "r", editor, { sellingPrice: 200 }), { status: 403 });
  await assert.rejects(svc.remove("hotel-bookings", "r", editor), { status: 403 });
});

test("generic CRUD cannot forge attachment ownership or bypass transactional ticket refunds", async () => {
  const svc = new ResourcesService({} as never, {} as never, audit as never);
  const admin = { ...user, isSuperAdmin: true };
  for (const resource of ["documents", "ticket-refunds"]) {
    await assert.rejects(svc.create(resource, admin, { storageKey: "foreign", entityType: "customer", entityId: "a" }), { status: 403 });
    await assert.rejects(svc.update(resource, "foreign", admin, { entityId: "a" }), { status: 403 });
    await assert.rejects(svc.remove(resource, "foreign", admin), { status: 403 });
  }
});


test("refunds reject sub-cent inputs before posting", async () => {
  for (const refundAmount of [100.009, 0.001, NaN, Infinity]) {
    const h = refundsHarness();
    await assert.rejects(h.ctrl.refund("t", { refundAmount, reason: "test" }, req()), { status: 400 });
    assert.equal(h.state().journals.length, 0);
    assert.equal(h.state().refunds.length, 0);
  }
});
