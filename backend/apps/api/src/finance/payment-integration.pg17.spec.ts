import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { readFileSync } from "node:fs";
import { PrismaClient, Prisma } from "@prisma/client";
import { ReceiptOperations } from "./receipt-operations";
import { AccountingService } from "./accounting.service";
import { WorkflowsController } from "../workflows/workflows.controller";
import { UmrahOpsService } from "../umrah/umrah-ops.service";
import { ReservationService } from "../reservation/reservation.service";
import { SequenceService } from "../common/sequence.service";
import { AuditService } from "../common/audit.service";
import type { AuthUser } from "../auth/auth.types";

const url = process.env.ZAT_SYNTHETIC_DATABASE_URL;
test("Gate A PG17: typed allocations and atomic initial/module receipts", { skip: !url }, async t => {
  const target = new URL(url!);
  assert.equal(target.hostname, "127.0.0.1"); assert.equal(target.port, "55463");
  assert.equal(target.pathname, "/zat_synthetic_payment_integration");
  const db = new PrismaClient({ datasourceUrl: url });
  try {
    const [server] = await db.$queryRaw<{ version: number }[]>`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(server.version >= 170000 && server.version < 180000);
    for (const [code, type] of [["1100", "ASSET"], ["1200", "ASSET"], ["1300", "ASSET"], ["2100", "LIABILITY"], ["4100", "REVENUE"], ["4200", "REVENUE"], ["4300", "REVENUE"], ["4400", "REVENUE"], ["5100", "EXPENSE"]] as const) await db.chartOfAccount.upsert({ where: { code }, update: {}, create: { code, name: "Synthetic payment account", type } });
    const branch = await db.branch.create({ data: { code: randomUUID(), name: "Synthetic payment branch" } });
    const staff = await db.user.create({ data: { email: `${randomUUID()}@example.test`, username: randomUUID(), fullName: "Synthetic payment staff", passwordHash: "invalid", defaultBranchId: branch.id } });
    const user = { id: staff.id, isSuperAdmin: true, branchIds: [branch.id], defaultBranchId: branch.id } as AuthUser;
    const req = { user } as never;
    const seq = new SequenceService(db as never), audit = new AuditService(db as never), accounting = new AccountingService(db as never, seq, audit);
    const ops = new ReceiptOperations(db as never, seq, audit, accounting);
    const workflows = new WorkflowsController(db as never, seq, audit, accounting, {} as never);
    const umrah = new UmrahOpsService(db as never, seq, audit, accounting);
    const reservations = new ReservationService(db as never, seq, audit, accounting);
    const customer = () => db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Synthetic paid traveler", branchId: branch.id } });
    const hotel = await db.hotel.create({ data: { hotelNumber: randomUUID(), name: "Synthetic payment hotel", city: "Makkah", country: "Saudi Arabia" } });
    const snapshot = async () => ({ tickets: await db.ticketSale.count(), receipts: await db.receipt.count(), journals: await db.journalEntry.count(), reissues: await db.ticketReissue.count() });
    let paidTicketId = "", paidUmrahId = "";

    await t.test("receipt maintenance blocks initial payments, direct receipts and review without writes", async () => {
      const previous = process.env.RECEIPT_WRITES_DISABLED;
      const before = await snapshot();
      process.env.RECEIPT_WRITES_DISABLED = "true";
      try {
        await assert.rejects(workflows.sellTicket({ fare: 100, paidAmount: 10, paymentMethod: "CASH" }, req, randomUUID()), { status: 503 });
        await assert.rejects(ops.create({ amount: 10, method: "CASH" }, user, randomUUID()), { status: 503 });
        await assert.rejects(ops.review("synthetic", true, user), { status: 503 });
        assert.deepEqual(await snapshot(), before);
      } finally {
        if (previous === undefined) delete process.env.RECEIPT_WRITES_DISABLED;
        else process.env.RECEIPT_WRITES_DISABLED = previous;
      }
    });

    await t.test("ticket initial payment and lost/concurrent retries return one booking and receipt", async () => {
      const party = await customer(), key = randomUUID();
      const body = { customerId: party.id, ticketNumber: randomUUID(), fare: 100, cost: 60, paidAmount: 30, paymentMethod: "CASH" };
      const [first, retry] = await Promise.all([workflows.sellTicket(body, req, key), workflows.sellTicket(body, req, key)]);
      assert.equal(first.id, retry.id); paidTicketId = first.id;
      assert.equal(first.paidAmount.toFixed(2), "30.00");
      assert.equal(first.paymentStatus, "PARTIAL");
      assert.equal(await db.receipt.count({ where: { ticketSaleId: first.id } }), 1);
      assert.equal((await accounting.arAp("customer")).find(r => r.partyId === party.id)?.balance, 70);
      await assert.rejects(workflows.sellTicket({ ...body, sector: "changed" }, req, key), { status: 409 });
      const before = await snapshot();
      await assert.rejects(workflows.sellTicket({ ...body, ticketNumber: randomUUID() }, req, randomUUID()), { status: 409 });
      assert.deepEqual(await snapshot(), before);
    });
    await t.test("initial paid amount requires explicit method, key and existing finance authority", async () => {
      const party = await customer(), body = { customerId: party.id, fare: 50, paidAmount: 10 };
      const before = await snapshot();
      await assert.rejects(workflows.sellTicket(body, req, randomUUID()), { status: 400 });
      await assert.rejects(workflows.sellTicket({ ...body, paymentMethod: "CASH" }, req), { status: 400 });
      await assert.rejects(workflows.sellTicket({ ...body, paymentMethod: "CASH" }, { user: { ...user, isSuperAdmin: false } } as never, randomUUID()), { status: 403 });
      assert.deepEqual(await snapshot(), before);
      const unpaid = await workflows.sellTicket({ ticketNumber: randomUUID(), customerId: party.id, fare: 50, paidAmount: 0 }, req);
      assert.equal(unpaid.paidAmount.toFixed(2), "0.00");
    });
    await t.test("concurrent unpaid submissions issue only one ticket for the same number", async () => {
      const party = await customer();
      const body = { ticketNumber: randomUUID(), customerId: party.id, fare: 50, paidAmount: 0 };
      const results = await Promise.allSettled([workflows.sellTicket(body, req), workflows.sellTicket(body, req)]);
      assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
      assert.equal(await db.ticketSale.count({ where: { ticketNumber: body.ticketNumber } }), 1);
      const issued = await db.ticketSale.findUniqueOrThrow({ where: { ticketNumber: body.ticketNumber } });
      assert.equal(await db.receipt.count({ where: { ticketSaleId: issued.id } }), 0);
    });
    await t.test("transport receipt uses selling value, not profit, and later reviewed payments reconcile", async () => {
      const party = await customer(), key = randomUUID();
      const body = { customerId: party.id, sellingPrice: 100, cost: 40, paid: 30, paymentMethod: "BANK", tripDate: "2052-01-01" };
      const booking = await workflows.sellTransport(body, req, key);
      assert.equal(booking.paid.toFixed(2), "30.00");
      assert.equal((await workflows.sellTransport(body, req, key)).id, booking.id);
      const initial = await db.receipt.findFirstOrThrow({ where: { transportBookingId: booking.id } });
      await ops.review(initial.id, true, user);
      const receipt = await ops.create({ transportBookingId: booking.id, amount: 70, method: "BANK" }, user, randomUUID());
      assert.equal((await db.transportBooking.findUniqueOrThrow({ where: { id: booking.id } })).paymentStatus, "PAID");
      await ops.review(receipt.id, true, user);
      await assert.rejects(ops.create({ transportBookingId: booking.id, amount: 0.01, method: "CASH" }, user, randomUUID()), { status: 400 });
      assert.equal((await accounting.arAp("customer")).some(r => r.partyId === party.id), false);
    });
    await t.test("Umrah initial receipt keeps existing typed booking link and no duplicate booking", async () => {
      const party = await customer(), key = randomUUID();
      const body = { customerId: party.id, branchId: branch.id, sellingPrice: 100, cost: 40, paid: 30, paymentMethod: "CASH" };
      const booking = await umrah.save(user, body, undefined, key); paidUmrahId = booking.id;
      assert.equal((await umrah.save(user, body, undefined, key)).id, booking.id);
      assert.equal(booking.balance.toFixed(2), "70.00");
      assert.equal(await db.receipt.count({ where: { bookingId: booking.id } }), 1);
    });
    await t.test("hotel creation, sale/cost and typed initial receipt commit together", async () => {
      const party = await customer(), key = randomUUID();
      const body = { customerId: party.id, branchId: branch.id, paid: 30, paymentMethod: "CASH", segments: [{ hotelId: hotel.id, checkIn: "2052-02-01", checkOut: "2052-02-03", rooms: [{ sellingPrice: 100, supplierCost: 40 }] }] };
      const booking = await reservations.save(user, body, undefined, undefined, key);
      assert.equal((await reservations.save(user, body, undefined, undefined, key)).id, booking.id);
      assert.equal(booking.paid.toFixed(2), "30.00"); assert.equal(booking.balance.toFixed(2), "70.00");
      assert.equal(await db.receipt.count({ where: { hotelBookingId: booking.id } }), 1);
    });
    await t.test("STAR initial payment shares the transaction and source receipt", async () => {
      const party = await customer(), key = randomUUID();
      const body = { customerId: party.id, paid: 30, paymentMethod: "BANK", rooms: [{ hotelId: hotel.id, roomType: "Synthetic", roomNo: randomUUID(), checkIn: "2052-03-01", checkOut: "2052-03-03", cost: 40, sale: 100 }] };
      const booking = await workflows.createStar(body, req, key);
      assert.equal((await workflows.createStar(body, req, key)).id, booking.id);
      assert.equal(booking.paid.toFixed(2), "30.00");
      assert.equal(await db.receipt.count({ where: { starBookingId: booking.id } }), 1);
    });
    await t.test("both API and database reject allocating one receipt to multiple sources", async () => {
      await assert.rejects(ops.create({ bookingId: paidUmrahId, ticketSaleId: paidTicketId, amount: 1, method: "CASH" }, user, randomUUID()), { status: 400 });
      await assert.rejects(db.receipt.create({ data: { receiptNo: randomUUID(), bookingId: paidUmrahId, ticketSaleId: paidTicketId, amount: 1, method: "CASH" } }));
      await assert.rejects(db.ticketSale.delete({ where: { id: paidTicketId } }));
    });
    await t.test("initial receipt audit failure rolls back source, journals, receipt and sequences", async () => {
      const party = await customer();
      const before = { ...await snapshot(), sequence: await db.numberSequence.findMany({ orderBy: { key: "asc" } }) };
      const failedAudit = { log: async (event: Parameters<typeof audit.log>[0]) => { if (event.entity === "Receipt") throw Error("synthetic receipt audit failure"); return audit.log(event); } };
      const failing = new WorkflowsController(db as never, seq, failedAudit as never, accounting, {} as never);
      await assert.rejects(failing.sellTicket({ customerId: party.id, fare: 100, paidAmount: 30, paymentMethod: "CASH" }, req, randomUUID()), /synthetic receipt audit failure/);
      assert.deepEqual({ ...await snapshot(), sequence: await db.numberSequence.findMany({ orderBy: { key: "asc" } }) }, before);
    });
    await t.test("legacy unallocated paid totals are held for review without backfill", async () => {
      const party = await customer();
      const booking = await db.ticketSale.create({ data: { customerId: party.id, branchId: branch.id, fare: 100, net: 100, paidAmount: 20, status: "ISSUED", paymentStatus: "PARTIAL" } });
      const before = await snapshot();
      await assert.rejects(ops.create({ ticketSaleId: booking.id, amount: 10, method: "CASH" }, user, randomUUID()), { status: 409 });
      assert.deepEqual(await snapshot(), before);
    });
    await t.test("customer/branch mismatch and invalid monetary inputs produce no writes", async () => {
      const other = await customer(), before = await snapshot();
      await assert.rejects(ops.create({ ticketSaleId: paidTicketId, customerId: other.id, amount: 1, method: "CASH" }, user, randomUUID()), { status: 400 });
      for (const amount of [0, -1, 0.001, NaN]) await assert.rejects(ops.create({ ticketSaleId: paidTicketId, amount, method: "CASH" }, user, randomUUID()), { status: 400 });
      assert.deepEqual(await snapshot(), before);
    });
    await t.test("every journal balances and destructive schema rollback refuses allocated data", async () => {
      const journals = await db.journalEntry.findMany({ where: { branchId: branch.id }, include: { lines: true } });
      for (const journal of journals) assert.equal(journal.lines.reduce((sum, line) => sum.plus(line.debit).minus(line.credit), new Prisma.Decimal(0)).toFixed(2), "0.00");
      const sql = readFileSync("review/receipt-allocation-rollback.draft.sql", "utf8").split('ALTER TABLE "Receipt"')[0];
      await assert.rejects(db.$executeRawUnsafe(sql));
      assert.ok(await db.receipt.count() > 0);
    });
  } finally { await db.$disconnect(); }
});
