import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "@prisma/client";
import { WorkflowsController } from "../workflows/workflows.controller";
import { UmrahOpsService } from "../umrah/umrah-ops.service";
import { CrmService } from "../crm/crm.service";
import { ResourcesService } from "../resources/resources.service";
import { ReservationService } from "../reservation/reservation.service";
import { assertHotelRoomLinks } from "../reservation/hotel-links";
import { ManagementController } from "./management.controller";
import { CrmController } from "../crm/crm.controller";
import { FinanceController } from "../finance/finance.controller";
import { ComplaintsController } from "../complaints/complaints.controller";
import { ReservationController } from "../reservation/reservation.controller";
import { UmrahOpsController } from "../umrah/umrah-ops.controller";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { STAFF_WORKFLOWS } from "../../../../../src/lib/staff-workflows";
import { packageCatalog, assertBookablePackage } from "../umrah/package-catalog";
import type { AuthUser } from "../auth/auth.types";

const user: AuthUser = { id: "synthetic-user", email: "synthetic@example.invalid", username: "synthetic", fullName: "Synthetic", isSuperAdmin: false, branchIds: ["a"], defaultBranchId: "a", roleNames: [], permissions: ["ticket.create", "transport.create", "umrah.create"] };
const req = { user } as never;

test("Umrah catalog requires permission, groups room variants and excludes costs", async () => {
  assert.throws(() => packageCatalog(user, []), { status: 403 });
  const base = { id: "sharing", packageNumber: "QFC-UP-123456-SHARING", flightInfo: "Synthetic Air\nISB-JED\n22 Oct\nUG-123456\nSA 100 22 Oct ISB-JED 10:00 - 12:00\n0\nSeats", description: "Captured: 2026-10-19T00:00:00Z", makkahNights: 8, madinahNights: 6, adultPrice: 100, childPrice: 80, infantPrice: 20, roomType: "SHARING", status: "REVIEW_REQUIRED", isPublic: false, makkahHotel: { name: "Synthetic Makkah", distance: "500 M" }, madinahHotel: null, adultCost: "NEVER_EXPOSE" };
  const result = packageCatalog({ ...user, permissions: ["umrah.view"] }, [base, { ...base, id: "quad", packageNumber: "QFC-UP-123456-QUAD", roomType: "QUAD", adultPrice: 110 }] as never);
  assert.equal(result.groups.length, 1); assert.equal(result.groups[0].offers.length, 1); assert.equal(result.groups[0].offers[0].rates.length, 2);
  assert.equal(result.groups[0].sourceSeats, 0); assert.equal(result.canEdit, false); assert.doesNotMatch(JSON.stringify(result), /NEVER_EXPOSE|adultCost/);
  await assert.rejects(assertBookablePackage({ umrahPackage: { findUnique: async () => ({ status: "REVIEW_REQUIRED" }) } } as never, "sharing"), { status: 400 });
  await assertBookablePackage({ umrahPackage: { findUnique: async () => ({ status: "ACTIVE" }) } } as never, "active");
});

test("dedicated and generic Umrah writers reject unreviewed packages before booking writes", async () => {
  let writes = 0;
  const tx = { umrahPackage: { findUnique: async () => ({ status: "REVIEW_REQUIRED" }) }, umrahBooking: { create: async () => { writes++; } } };
  const db = { ...tx, $transaction: async (run: (tx: unknown) => unknown) => run(tx) };
  const body = { packageId: "source-draft", customerId: "customer-a" };
  await assert.rejects(new UmrahOpsService(db as never, {} as never, {} as never, {} as never).save(user, body), /Review and activate/);
  await assert.rejects(new ResourcesService(db as never, { next: async () => "test-number" } as never, {} as never).create("umrah-bookings", { ...user, isSuperAdmin: true }, body), { status: 403 });
  assert.equal(writes, 0);
});

test("every management workflow targets an existing POST route with the matching permission", () => {
  const routes = new Map<string, string | undefined>();
  for (const controller of [ManagementController, CrmController, FinanceController, ComplaintsController, ReservationController, UmrahOpsController, WorkflowsController]) {
    const prefix = Reflect.getMetadata(PATH_METADATA, controller);
    for (const name of Object.getOwnPropertyNames(controller.prototype)) {
      const handler = controller.prototype[name as keyof typeof controller.prototype];
      if (typeof handler !== "function" || Reflect.getMetadata(METHOD_METADATA, handler) !== RequestMethod.POST) continue;
      const path = Reflect.getMetadata(PATH_METADATA, handler);
      routes.set(`/${["api", prefix, path].join("/").split("/").filter(Boolean).join("/")}`, Reflect.getMetadata("permission", handler));
    }
  }
  for (const actions of Object.values(STAFF_WORKFLOWS)) for (const action of actions) {
    assert.ok(routes.has(action.path), `Missing backend route for ${action.label}: ${action.path}`);
    // Management routes authorize inside the service; all other controllers use
    // the permission decorator, which must agree with the frontend action.
    if (!action.path.startsWith("/api/v1/management/")) assert.equal(routes.get(action.path), action.permission, action.label);
    for (const field of action.fields) assert.ok(field.name && field.type && field.label, `${action.label}: invalid form field`);
  }
});

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

test("quotation items reject invalid quantities and amounts before database access", async () => {
  const svc = new CrmService({} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  for (const data of [{ quantity: 0 }, { quantity: -1 }, { quantity: 1.5 }, { quantity: Infinity }, { quantity: 2147483648 }, { quantity: "2" }, { cost: -1 }, { sellingPrice: NaN }, { cost: {} }, { description: 42 }]) {
    await assert.rejects(svc.addQuoteItem("quote", { description: "Synthetic", ...data } as never), { status: 400 });
  }
});

test("quotation item quantities and amounts reach the existing recalculation", async () => {
  let created: unknown;
  const db = { $transaction: async (run: (tx: unknown) => unknown) => run(db), $queryRaw: async () => [], umrahBooking: { findFirst: async () => null }, quotation: { findUnique: async () => ({ id: "quote", status: "DRAFT", items: [{ quantity: 2, sellingPrice: new Prisma.Decimal(10), cost: new Prisma.Decimal(5) }], discount: 0, tax: 0 }), update: async ({ data }: { data: unknown }) => data }, quotationItem: { create: async ({ data }: { data: unknown }) => { created = data; } } };
  const svc = new CrmService(db as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  const result = await svc.addQuoteItem("quote", { description: " Synthetic ", quantity: 2, sellingPrice: 10, cost: 5 });
  assert.deepEqual(created, { quotationId: "quote", description: "Synthetic", quantity: 2, sellingPrice: 10, cost: 5 });
  assert.deepEqual(result, { sellingTotal: new Prisma.Decimal(20), costTotal: new Prisma.Decimal(10), net: new Prisma.Decimal(20) });
});

test("hotel references reject foreign, missing, deleted and mismatched physical rooms", async () => {
  const db = { hotelRoomType: { findUnique: async ({ where }: { where: { id: string } }) => where.id === "missing" ? null : { hotelId: where.id === "foreign" ? "b" : "a" } }, hotelRoom: { findUnique: async ({ where }: { where: { id: string } }) => ({ hotelId: where.id === "foreign" ? "b" : "a", roomTypeId: "type-a", deletedAt: where.id === "deleted" ? new Date() : null }) } };
  await assertHotelRoomLinks(db as never, { hotelId: "a", roomTypeId: "type-a", hotelRoomId: "room-a" });
  for (const input of [{ hotelId: "a", roomTypeId: "foreign" }, { hotelId: "a", roomTypeId: "missing" }, { hotelId: "a", hotelRoomId: "foreign" }, { hotelId: "a", hotelRoomId: "deleted" }, { hotelId: "a", roomTypeId: "type-other", hotelRoomId: "room-a" }]) await assert.rejects(assertHotelRoomLinks(db as never, input), { status: 400 });
});

test("generic physical-room create and edit reject another hotel's room type before writes", async () => {
  let writes = 0;
  const db = { hotelRoomType: { findUnique: async () => ({ hotelId: "b" }) }, hotelRoom: { findUnique: async () => ({ id: "room", hotelId: "a", roomTypeId: "old" }), create: async () => { writes++; }, update: async () => { writes++; } } };
  const svc = new ResourcesService(db as never, {} as never, {} as never);
  const admin = { ...user, isSuperAdmin: true };
  await assert.rejects(svc.create("hotel-physical-rooms", admin, { hotelId: "a", roomNumber: "1", roomTypeId: "foreign" }), { status: 400 });
  await assert.rejects(svc.update("hotel-physical-rooms", "room", admin, { roomTypeId: "foreign" }), { status: 400 });
  assert.equal(writes, 0);
});

test("reservation graph rejects another hotel's room type inside its transaction", async () => {
  let writes = 0;
  const tx = { hotelRoomType: { findUnique: async () => ({ hotelId: "b" }) }, hotelBooking: { create: async () => { writes++; } } };
  const db = { $transaction: async (run: (tx: unknown) => unknown) => run(tx) };
  const svc = new ReservationService(db as never, {} as never, {} as never, {} as never);
  await assert.rejects(svc.save({ ...user, isSuperAdmin: true }, { segments: [{ hotelId: "a", checkIn: "2026-10-20", checkOut: "2026-10-22", rooms: [{ roomTypeId: "foreign" }] }] }), { status: 400 });
  assert.equal(writes, 0);
});
