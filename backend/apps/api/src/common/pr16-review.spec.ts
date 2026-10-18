import assert from "node:assert/strict";
import { test } from "node:test";
import { ResourcesService } from "../resources/resources.service";
import { WorkflowsController } from "../workflows/workflows.controller";
import { ReservationService } from "../reservation/reservation.service";
import { PeopleOcrService } from "../crm/people-ocr.service";
import { DocumentsController } from "../documents/documents.controller";
import { authorizeDocumentOwner } from "../documents/document-scope";
import { AuthUser } from "../auth/auth.types";
import { AccountingService } from "../finance/accounting.service";
import { AuditService } from "../common/audit.service";
import { ComplaintsService } from "../complaints/complaints.service";
import { UmrahOpsService } from "../umrah/umrah-ops.service";
import { SequenceService } from "../common/sequence.service";
const user: AuthUser = { id: "staff", email: "test@test", username: "staff", fullName: "Staff", permissions: ["passenger.view", "passenger.create", "passenger.edit", "passenger.delete", "document.view", "customer.view", "hotel.booking", "reservation.cancel", "reservation.split", "reservation.checkin", "reservation.checkout", "reservation.transfer"], roleNames: [], branchIds: ["a"], defaultBranchId: "a", isSuperAdmin: false };
const request = { user } as never;
const audit = { log: async () => {} };
test("document metadata list/get and partial or unknown ownership cannot bypass download scope", async () => {
  const db = { storedDocument: { findUnique: async () => ({ entityType: "customer", entityId: "b", uploadedById: user.id }) }, customer: { findUnique: async () => ({ branchId: "b" }) } };
  const svc = new ResourcesService(db as never, {} as never, audit as never);
  await assert.rejects(svc.list("documents", user, {}), { status: 403 });
  await assert.rejects(svc.list("documents", user, { entityType: "customer", entityId: "b" }), { status: 404 });
  await assert.rejects(svc.get("documents", "d", user), { status: 404 });
  await assert.rejects(authorizeDocumentOwner(db as never, user, "constructor", "d"), { status: 404 });
  for (const doc of [{ entityType: "customer", uploadedById: user.id }, { entityId: "b", uploadedById: user.id }]) {
    const ctrl = new DocumentsController({ storedDocument: { findUnique: async () => doc } } as never, {} as never);
    await assert.rejects(ctrl.download("d", {} as never, request), { status: 404 });
  }
});

test("generic passenger document read/write/delete and reattachment resolve passenger ownership", async () => {
  const db = { passengerDocument: { findUnique: async () => ({ passengerId: "b" }) }, passenger: { findUnique: async () => ({ customerId: "b" }) }, customer: { findUnique: async () => ({ branchId: "b" }) } };
  const svc = new ResourcesService(db as never, {} as never, audit as never);
  await assert.rejects(svc.get("passenger-documents", "d", user), { status: 404 });
  await assert.rejects(svc.update("passenger-documents", "d", user, {}), { status: 404 });
  await assert.rejects(svc.remove("passenger-documents", "d", user), { status: 404 });
  await assert.rejects(svc.create("passenger-documents", user, { passengerId: "b" }), { status: 404 });
});

test("expiry alerts use customer branch scope and quotation conversion checks linked customer", async () => {
  let where: unknown;
  const db = { passenger: { findMany: async (args: { where: unknown }) => { where = args.where; return []; } }, quotation: { findUnique: async () => ({ branchId: "a", customerId: "b" }) }, customer: { findUnique: async () => ({ branchId: "b" }) } };
  const ctrl = new WorkflowsController(db as never, {} as never, audit as never, {} as never, {} as never);
  await ctrl.expiryAlerts(request);
  assert.deepEqual((where as { customer: unknown }).customer, { branchId: { in: ["a"] } });
  await assert.rejects(ctrl.convertQuote("q", request), { status: 404 });
});

test("OCR cannot copy a foreign bound extract into an authorized target", async () => {
  const svc = new PeopleOcrService({ ocrExtract: { findUnique: async () => ({ passengerId: "foreign", parsed: { name: "Private" } }) }, passenger: { findUnique: async () => ({ customerId: "b" }) }, customer: { findUnique: async () => ({ branchId: "b" }) } } as never, audit as never);
  await assert.rejects(svc.confirm(user, { extractId: "x", passengerId: "a", overwriteFields: ["fullName"] }), { status: 404 });
});

test("OCR history records only a passport change actually authorized by overwriteFields", async () => {
  let history = 0;
  const svc = new PeopleOcrService({ ocrExtract: { findUnique: async () => ({ id: "x", parsed: { passport_number: "NEW" } }), update: async () => ({}) }, passenger: { findUnique: async () => ({ id: "a", customerId: "a", passportNumber: "OLD" }), update: async () => ({}) }, customer: { findUnique: async () => ({ branchId: "a" }) }, passportHistory: { create: async () => { history++; } } } as never, audit as never);
  await svc.confirm(user, { extractId: "x", passengerId: "a" });
  assert.equal(history, 0);
});

test("reservation get, cancellation and room mutations reject foreign bookings before writes", async () => {
  const booking = { branchId: "b", cancelledAt: null, staySegments: [] };
  const tx = { $queryRaw: async () => [], hotelBooking: { findUnique: async () => booking }, hotelStayRoom: { findUnique: async () => ({ segment: { bookingId: "b", booking } }) } };
  const svc = new ReservationService({ ...tx, $transaction: async (run: (db: typeof tx) => Promise<unknown>) => run(tx) } as never, {} as never, audit as never, {} as never);
  await assert.rejects(svc.get(user, "b"), { status: 404 });
  await assert.rejects(svc.cancel(user, "b", "test"), { status: 404 });
  await assert.rejects(svc.checkin(user, "room"), { status: 404 });
  await assert.rejects(svc.checkout(user, "room"), { status: 404 });
  await assert.rejects(svc.transfer(user, "room", undefined, undefined), { status: 404 });
});

test("priced reservation split cannot duplicate posted accounting", async () => {
  const svc = new ReservationService({ hotelBooking: { findUnique: async () => ({ branchId: "a", net: 100, cost: 50, paid: 0, staySegments: [] }) } } as never, {} as never, audit as never, {} as never);
  await assert.rejects(svc.split(user, "r", ["room"]), /cannot be split/);
});

test("cancellation posts balanced party-preserving offsets and audit through the real accounting helper; failures roll back", async () => {
  for (const fail of [false, true]) {
    let committed = { cancelled: false, journals: [] as { lines: { create: { debit: number; credit: number; partyId?: string }[] } }[], audits: 0 };
    const originals = [100, 50].map((n, i) => ({ entryNumber: "J" + i, branchId: "a", lines: [{ accountId: "debit", debit: n, credit: 0, partyType: "customer", partyId: "c" }, { accountId: "credit", debit: 0, credit: n, partyType: "supplier", partyId: "s" }] }));
    const prisma = { $transaction: async (run: (tx: unknown) => Promise<unknown>) => {
      const draft = structuredClone(committed); let locked = false;
      const tx = { $queryRaw: async (sql: TemplateStringsArray) => { assert.match(sql.join("?"), /HotelBooking.*FOR UPDATE/); locked = true; },
        hotelBooking: { findUnique: async () => { assert.ok(locked); return { branchId: "a", paid: 25, cancelledAt: null, staySegments: [] }; }, update: async ({ data }: { data: { balance: { toNumber(): number } } }) => { assert.equal(data.balance.toNumber(), -25); if (fail) throw Error("injected update failure"); draft.cancelled = true; return data; } },
        journalEntry: { findMany: async () => originals, create: async ({ data }: { data: typeof draft.journals[number] }) => { draft.journals.push(data); return { id: "j" }; } },
        numberSequence: { upsert: async () => ({ current: 1, padLength: 6 }) }, auditLog: { create: async () => { draft.audits++; } },
      };
      const result = await run(tx); committed = draft; return result;
    } };
    const actualAudit = new AuditService(prisma as never);
    const accounting = new AccountingService(prisma as never, new SequenceService(prisma as never), actualAudit);
    const svc = new ReservationService(prisma as never, {} as never, actualAudit, accounting);
    if (fail) { await assert.rejects(svc.cancel(user, "r", "test"), /injected/); assert.deepEqual(committed, { cancelled: false, journals: [], audits: 0 }); }
    else { await svc.cancel(user, "r", "test"); assert.equal(committed.audits, 3); assert.equal(committed.cancelled, true); committed.journals.forEach((journal, i) => journal.lines.create.forEach((line, j) => { assert.equal(line.debit, originals[i].lines[j].credit); assert.equal(line.credit, originals[i].lines[j].debit); assert.equal(line.partyId, originals[i].lines[j].partyId); })); }
  }
});

test("all workflow source mutations and passenger attachment writes deny foreign records", async () => {
  const foreign = { branchId: "b", rooms: [] };
  const db = { umrahBooking: { findUnique: async () => foreign }, ticketSale: { findUnique: async () => foreign }, umrahGroup: { findUnique: async () => foreign }, starBooking: { findUnique: async () => foreign }, customer: { findUnique: async () => ({ branchId: "a" }) }, passenger: { findUnique: async () => ({ customerId: "b" }) } };
  const ctrl = new WorkflowsController(db as never, {} as never, audit as never, {} as never, {} as never);
  await assert.rejects(ctrl.umrahStep("b", {}, request), { status: 404 });
  await assert.rejects(ctrl.allocateSeats("b", { seats: 1 }, request), { status: 404 });
  await assert.rejects(ctrl.reissue("b", {}, request), { status: 404 });
  await assert.rejects(ctrl.getStar("b", request), { status: 404 });
  await assert.rejects(ctrl.allocateStar("b", { rooms: [] }, request), { status: 404 });
  const svc = new ResourcesService({ customer: { findUnique: async () => ({ branchId: "b" }) }, passenger: { findUnique: async () => ({ customerId: "b" }) } } as never, {} as never, audit as never);
  await assert.rejects(svc.create("tickets", { ...user, permissions: ["ticket.create"] }, { passengerId: "b" }), { status: 404 });
  await assert.rejects(svc.update("tickets", "a", { ...user, permissions: ["ticket.edit"] }, { paidAmount: 1000 }), { status: 403 });
});

test("reservation edits preserve omitted paid amount and reject replacing started stay history", async () => {
  const existing = { id: "r", branchId: "a", customerId: "a", cost: 50, sellingPrice: 100, discount: 0, tax: 0, commission: 0, net: 100, paid: 25, staySegments: [] as { rooms: { status: string }[] }[] };
  let updated = false;
  const tx = { $queryRaw: async () => [], hotelBooking: { findUnique: async () => existing, update: async ({ data }: { data: { paid: { toNumber(): number }; notes: string } }) => { assert.equal(data.paid.toNumber(), 25); assert.equal(data.notes, "note"); updated = true; return { id: "r" }; } }, customer: { findUnique: async () => ({ branchId: "a" }) }, hotelStayRoom: { findMany: async () => [] }, hotelStaySegment: { deleteMany: async () => ({}), create: async () => ({}) } };
  const svc = new ReservationService({ ...tx, $transaction: async (run: (tx: unknown) => Promise<unknown>) => run(tx) } as never, {} as never, audit as never, {} as never);
  const input = { id: "r", customerId: "a", notes: "note", segments: [{ hotelId: "h", checkIn: "2026-12-01", checkOut: "2026-12-02", rooms: [{ sellingPrice: 100, supplierCost: 50 }] }] };
  await svc.save(user, input); assert.equal(updated, true);
  updated = false; existing.staySegments = [{ rooms: [{ status: "CHECKED_OUT" }] }];
  await assert.rejects(svc.save(user, input), /started stay/); assert.equal(updated, false);
});


test("dedicated Umrah and complaint paths cannot attach or expose foreign passengers", async () => {
  const db = { passenger: { findUnique: async () => ({ customerId: "b" }) }, customer: { findUnique: async ({ where }: { where: { id: string } }) => ({ branchId: where.id }) }, complaint: { findUnique: async () => ({ branchId: "b" }) } };
  const umrah = new UmrahOpsService(db as never, {} as never, audit as never, {} as never);
  await assert.rejects(umrah.save({ ...user, permissions: ["umrah.create"] }, { customerId: "a", passengerIds: ["b"] }), { status: 404 });
  const complaints = new ComplaintsService(db as never, {} as never, audit as never, {} as never);
  await assert.rejects(complaints.create(user, { customerId: "a", passengerId: "b", description: "test" }), { status: 404 });
  await assert.rejects(complaints.get(user, "b"), { status: 404 });
  await assert.rejects(complaints.update(user, "b", {}), { status: 404 });
  await assert.rejects(complaints.remove(user, "b"), { status: 404 });
});

test("passenger ownership follows the same linked-lead restriction as dedicated CRM routes", async () => {
  const svc = new ResourcesService({ passenger: { findUnique: async () => ({ customerId: "a" }) }, customer: { findUnique: async () => ({ branchId: "a", leadId: "foreign" }) }, lead: { findUnique: async () => ({ branchId: "b" }) } } as never, {} as never, audit as never);
  await assert.rejects(svc.get("passengers", "p", user), { status: 404 });
});
