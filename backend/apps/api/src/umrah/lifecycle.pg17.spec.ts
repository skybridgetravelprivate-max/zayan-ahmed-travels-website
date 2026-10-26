import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { UmrahOpsService } from "./umrah-ops.service";
import { SequenceService } from "../common/sequence.service";
import { AuditService } from "../common/audit.service";
import { AccountingService } from "../finance/accounting.service";
import type { AuthUser } from "../auth/auth.types";
import { ReservationService } from "../reservation/reservation.service";
import { ReceiptOperations } from "../finance/receipt-operations";
import { ReportsService } from "../reports/reports.service";
import { WebsiteCustomerBookingsService } from "../website/website-customer-bookings.service";

test("PG17 lifecycle: atomic cancellation, terminal status and financial review hold", { skip: !process.env.ZAT_SYNTHETIC_DATABASE_URL }, async t => {
  const url = new URL(process.env.ZAT_SYNTHETIC_DATABASE_URL!);
  assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, "55463"); assert.equal(url.pathname, "/zat_synthetic_manual_workflows");
  const db = new PrismaClient({ datasourceUrl: url.toString() });
  try {
    const [server] = await db.$queryRaw<{ version: number }[]>`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(server.version >= 170000 && server.version < 180000);
    const branch = await db.branch.create({ data: { code: randomUUID(), name: "Synthetic lifecycle branch" } });
    const staff = await db.user.create({ data: { username: randomUUID(), email: `${randomUUID()}@example.test`, fullName: "Synthetic lifecycle staff", passwordHash: "invalid" } });
    const actor = { id: staff.id, isSuperAdmin: true, branchIds: [branch.id], defaultBranchId: branch.id } as AuthUser;
    const seq = new SequenceService(db as never), audit = new AuditService(db as never), accounting = new AccountingService(db as never, seq, audit);
    const service = new UmrahOpsService(db as never, seq, audit, accounting);
    const customer = await db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Synthetic lifecycle traveler", branchId: branch.id } });
    const create = () => db.umrahBooking.create({ data: { bookingNumber: randomUUID(), customerId: customer.id, branchId: branch.id, status: "DRAFT", workflowStep: "Draft" } });
    await t.test("audit failure rolls back a cancellation status", async () => {
      const booking = await create();
      const fail = new UmrahOpsService(db as never, seq, { log: async () => { throw Error("synthetic audit failure"); } } as never, accounting);
      await assert.rejects(fail.lifecycle(actor, booking.id, "Cancelled"), /synthetic audit failure/);
      assert.equal((await db.umrahBooking.findUniqueOrThrow({ where: { id: booking.id } })).status, "DRAFT");
    });
    await t.test("financially posted cancellation is held without altering ledger or status", async () => {
      const booking = await create();
      await db.journalEntry.create({ data: { entryNumber: randomUUID(), date: new Date(), status: "POSTED", kind: "SALE", module: "umrah", sourceId: booking.id } });
      const before = { journals: await db.journalEntry.count(), audits: await db.auditLog.count(), receipts: await db.receipt.count() };
      await assert.rejects(service.lifecycle(actor, booking.id, "Cancelled"), { status: 409 });
      assert.equal((await db.umrahBooking.findUniqueOrThrow({ where: { id: booking.id } })).status, "DRAFT");
      assert.deepEqual({ journals: await db.journalEntry.count(), audits: await db.auditLog.count(), receipts: await db.receipt.count() }, before);
    });
    await t.test("foreign branch and missing permission cannot change lifecycle", async () => {
      const booking = await create();
      const outsider = { ...actor, isSuperAdmin: false, branchIds: [], defaultBranchId: null, permissions: ["umrah.edit"] } as AuthUser;
      await assert.rejects(service.lifecycle(outsider, booking.id, "Cancelled"));
      await assert.rejects(service.lifecycle({ ...outsider, branchIds: [branch.id], permissions: [] }, booking.id, "Cancelled"), { status: 403 });
      assert.equal((await db.umrahBooking.findUniqueOrThrow({ where: { id: booking.id } })).status, "DRAFT");
    });
    await t.test("cancellation lock prevents concurrent completion and repeat audit", async () => {
      const booking = await create();
      let release!: () => void, reached!: () => void;
      const hold = new Promise<void>(resolve => { release = resolve; });
      const locked = new Promise<void>(resolve => { reached = resolve; });
      const slowAudit = { log: async (event: Parameters<typeof audit.log>[0]) => { reached(); await hold; return audit.log(event); } };
      const slow = new UmrahOpsService(db as never, seq, slowAudit as never, accounting);
      const cancellation = slow.lifecycle(actor, booking.id, "Cancelled");
      await locked;
      const completion = service.lifecycle(actor, booking.id, "Completed");
      // Attach rejection handler before releasing the lock.
      const rejected = assert.rejects(completion, { status: 400 });
      release(); await cancellation; await rejected;
      const before = await db.auditLog.count({ where: { entityId: booking.id, action: "lifecycle" } });
      await service.lifecycle(actor, booking.id, "Cancelled");
      assert.equal(await db.auditLog.count({ where: { entityId: booking.id, action: "lifecycle" } }), before);
      assert.equal((await db.umrahBooking.findUniqueOrThrow({ where: { id: booking.id } })).status, "CANCELLED");
    });
    await t.test("legacy paid cancellation is held without inventing a receipt", async () => {
      const booking = await create();
      await db.umrahBooking.update({ where: { id: booking.id }, data: { paid: 10 } });
      const before = await db.receipt.count();
      await assert.rejects(service.lifecycle(actor, booking.id, "Cancelled"), { status: 409 });
      assert.equal(await db.receipt.count(), before);
    });
    await t.test("booking save cannot bypass cancellation review or reopen a cancelled stage", async () => {
      const booking = await create();
      await assert.rejects(service.save(actor, { id: booking.id, workflowStep: "Cancelled" }), { status: 403 });
      await service.lifecycle(actor, booking.id, "Cancelled");
      await assert.rejects(service.save(actor, { id: booking.id, workflowStep: "Completed" }), { status: 403 });
      assert.equal((await db.umrahBooking.findUniqueOrThrow({ where: { id: booking.id } })).workflowStep, "Cancelled");
    });
    await t.test("hotel cancellation retains real receipt and customer credit without cash payout", async () => {
      for (const [code, type] of [["1100", "ASSET"], ["1300", "ASSET"], ["2100", "LIABILITY"], ["4300", "REVENUE"], ["5100", "EXPENSE"]] as const) await db.chartOfAccount.upsert({ where: { code }, update: {}, create: { code, name: "Synthetic credit account", type } });
      const party = await db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Synthetic cancelled hotel traveler", branchId: branch.id } });
      const hotel = await db.hotel.create({ data: { hotelNumber: randomUUID(), name: "Synthetic cancellation hotel", city: "Makkah", country: "Saudi Arabia" } });
      const reservations = new ReservationService(db as never, seq, audit, accounting);
      const booking = await reservations.save(actor, { branchId: branch.id, customerId: party.id, paid: 30.25, paymentMethod: "CASH", segments: [{ hotelId: hotel.id, checkIn: "2052-01-01", checkOut: "2052-01-03", rooms: [{ sellingPrice: 100.50, supplierCost: 60.10 }] }] }, undefined, undefined, randomUUID());
      const results = await Promise.allSettled([reservations.cancel(actor, booking.id, "Synthetic cancellation"), reservations.cancel(actor, booking.id, "Synthetic retry")]);
      assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
      assert.equal((await reservations.get(actor, booking.id)).balance.toFixed(2), "-30.25");
      assert.equal(await db.receipt.count({ where: { hotelBookingId: booking.id } }), 1);
      assert.equal((await accounting.arAp("customer")).find(r => r.partyId === party.id)?.balance, -30.25);
      const report = await new ReportsService(db as never, accounting).run("receivables", {});
      assert.equal(report.rows.find(r => r.clientId === party.id)?.debit, -30.25);
      const cash = await db.chartOfAccount.findUniqueOrThrow({ where: { code: "1100" } });
      assert.equal((await db.journalLine.aggregate({ where: { accountId: cash.id, journal: { sourceId: booking.id } }, _sum: { credit: true } }))._sum.credit?.toFixed(2), "0.00");
      const ops = new ReceiptOperations(db as never, seq, audit, accounting);
      const receipt = await db.receipt.findFirstOrThrow({ where: { hotelBookingId: booking.id } });
      await ops.review(receipt.id, true, actor);
      await assert.rejects(ops.create({ hotelBookingId: booking.id, amount: 1, method: "CASH" }, actor, randomUUID()), { status: 400 });
      const visible = await new WebsiteCustomerBookingsService(db as never).listForWebsiteCustomer(party.id);
      assert.equal(visible.bookings.find(r => r.reference === booking.bookingNumber)?.status, "Cancelled");
      assert.ok(!(await new WebsiteCustomerBookingsService(db as never).listForWebsiteCustomer(customer.id)).bookings.some(r => r.reference === booking.bookingNumber));
    });
  } finally { await db.$disconnect(); }
});
