import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient, Prisma } from "@prisma/client";
import { ReservationService } from "./reservation.service";
import { AccountingService } from "../finance/accounting.service";
import { SequenceService } from "../common/sequence.service";
import { AuditService } from "../common/audit.service";
import type { AuthUser } from "../auth/auth.types";
const url = process.env.ZAT_SYNTHETIC_DATABASE_URL;
test("PG17: reservation split, occupancy and cancellation remain atomic", { skip: !url }, async t => {
  const target = new URL(url!);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname));
  assert.match(target.pathname, /^\/zat_synthetic_[a-z0-9_]+$/);
  const db = new PrismaClient({ datasourceUrl: url });
  try {
    const [server] = await db.$queryRaw<{ version: number }[]>`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(server.version >= 170000 && server.version < 180000);
    for (const [code, type] of [["1100", "ASSET"], ["1300", "ASSET"], ["2100", "LIABILITY"], ["4300", "REVENUE"], ["5100", "EXPENSE"]] as const) {
      await db.chartOfAccount.upsert({ where: { code }, update: {}, create: { code, name: "Synthetic reservation account", type } });
    }
    const branch = await db.branch.create({ data: { code: randomUUID(), name: "Synthetic hotel branch" } });
    const staff = await db.user.create({ data: { email: `${randomUUID()}@example.test`, username: randomUUID(), fullName: "Synthetic hotel staff", passwordHash: "invalid" } });
    const customer = await db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Synthetic hotel traveler", branchId: branch.id } });
    const hotel = await db.hotel.create({ data: { hotelNumber: randomUUID(), name: "Synthetic hotel", city: "Makkah", country: "Saudi Arabia" } });
    const actor = { id: staff.id, branchIds: [branch.id], defaultBranchId: null, isSuperAdmin: true } as AuthUser;
    const seq = new SequenceService(db as never), audit = new AuditService(db as never);
    const accounting = new AccountingService(db as never, seq, audit);
    const service = new ReservationService(db as never, seq, audit, accounting);
    const input = (rooms: { roomNumber?: string; sellingPrice?: number; supplierCost?: number }[]) => ({ branchId: branch.id, customerId: customer.id, segments: [{ hotelId: hotel.id, confirmationNo: "Synthetic confirmation", checkIn: "2051-01-01", checkOut: "2051-01-03", rooms }] });
    await t.test("split preserves branch, confirmation and exactly one physical room per booking", async () => {
      const original = await service.save(actor, input([{ roomNumber: "A" }, { roomNumber: "B" }]));
      const moved = original.staySegments[0].rooms.find(r => r.roomNumber === "B")!;
      const split = await service.split(actor, original.id, [moved.id]);
      const parent = await service.get(actor, original.id);
      assert.equal(parent.rooms, 1); assert.equal(parent.staySegments[0].rooms.length, 1);
      assert.equal(split.child.branchId, branch.id);
      assert.equal(split.child.parentBookingId, original.id);
      assert.equal(split.child.staySegments[0].rooms[0].roomNumber, "B");
      assert.equal(split.child.staySegments[0].confirmationNo, "Synthetic confirmation");
      assert.equal(await db.hotelBooking.count({ where: { parentBookingId: original.id } }), 1);
    });
    await t.test("late split audit failure restores original rooms and leaves no child", async () => {
      const original = await service.save(actor, input([{}, {}]));
      const failing = new ReservationService(db as never, seq, { log: async (event: Parameters<typeof audit.log>[0]) => { if (event.action === "split") throw Error("synthetic split audit failure"); await audit.log(event); } } as never, accounting);
      await assert.rejects(failing.split(actor, original.id, [original.staySegments[0].rooms[0].id]), /synthetic split audit failure/);
      assert.equal((await service.get(actor, original.id)).staySegments[0].rooms.length, 2);
      assert.equal(await db.hotelBooking.count({ where: { parentBookingId: original.id } }), 0);
    });
    await t.test("duplicate concurrent split commits once; moving all rooms and foreign branch access are denied", async () => {
      const original = await service.save(actor, input([{}, {}]));
      await assert.rejects(service.split(actor, original.id, original.staySegments[0].rooms.map(r => r.id)));
      const room = original.staySegments[0].rooms[0].id;
      const foreign = { ...actor, isSuperAdmin: false, permissions: ["reservation.split", "hotel.booking"], branchIds: [], defaultBranchId: null } as AuthUser;
      await assert.rejects(service.split(foreign, original.id, [room]));
      const results = await Promise.allSettled([service.split(actor, original.id, [room]), service.split(actor, original.id, [room])]);
      assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
      assert.equal(await db.hotelBooking.count({ where: { parentBookingId: original.id } }), 1);
    });
    await t.test("simultaneous physical-room reservations cannot double allocate", async () => {
      const room = "concurrent-" + randomUUID();
      const results = await Promise.allSettled([service.save(actor, input([{ roomNumber: room }])), service.save(actor, input([{ roomNumber: room }]))]);
      assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    });
    await t.test("cancellation reverses sale/cost once and preserves the customer's credit", async () => {
      const booking = await service.save(actor, { ...input([{ sellingPrice: 100, supplierCost: 60 }]), paid: 30 });
      await accounting.postReceipt({ userId: staff.id, amount: 30, method: "CASH", module: "reservation", sourceId: booking.id, customerId: customer.id, branchId: branch.id });
      const results = await Promise.allSettled([service.cancel(actor, booking.id, "Synthetic cancellation"), service.cancel(actor, booking.id, "Synthetic retry")]);
      assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
      const cancelled = await service.get(actor, booking.id);
      assert.equal(cancelled.balance.toFixed(2), "-30.00");
      assert.equal(await db.journalEntry.count({ where: { sourceId: booking.id, kind: "CANCELLATION" } }), 2);
      assert.equal((await accounting.arAp("customer")).find(r => r.partyId === customer.id)?.balance, -30);
      const journals = await db.journalEntry.findMany({ where: { sourceId: booking.id }, include: { lines: true } });
      for (const journal of journals) assert.equal(journal.lines.reduce((sum, line) => sum.plus(line.debit).minus(line.credit), new Prisma.Decimal(0)).toFixed(2), "0.00");
    });
  } finally { await db.$disconnect(); }
});
