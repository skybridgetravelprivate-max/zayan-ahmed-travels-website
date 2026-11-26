import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { dailyOperations } from "./daily-operations";
import type { AuthUser } from "../auth/auth.types";

const url = process.env.ZAT_SYNTHETIC_DATABASE_URL;
test("PG17 daily operations excludes foreign, cancelled and replaced service records", { skip: !url }, async () => {
  const target = new URL(url!);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(target.hostname));
  assert.match(target.pathname, /^\/zat_synthetic_[a-z0-9_]+$/);
  const db = new PrismaClient({ datasourceUrl: target.toString() });
  try {
    const [server] = await db.$queryRaw<{ version: number }[]>`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(server.version >= 170000 && server.version < 180000);
    await db.companySettings.upsert({ where: { id: "default" }, create: { id: "default", companyName: "Synthetic accounting company", timezone: "Asia/Karachi" }, update: { timezone: "Asia/Karachi" } });
    const branch = await db.branch.create({ data: { code: randomUUID(), name: "Synthetic accounting branch" } });
    const foreign = await db.branch.create({ data: { code: randomUUID(), name: "Synthetic foreign accounting branch" } });
    const customer = await db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Synthetic accounting customer", branchId: branch.id } });
    const outsider = await db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Synthetic foreign customer", branchId: foreign.id } });
    const actor = { id: "synthetic", isSuperAdmin: false, branchIds: [branch.id], permissions: ["reservation.view", "ticket.view", "transport.view"] } as AuthUser;
    const hotel = await db.hotel.create({ data: { hotelNumber: randomUUID(), name: "Synthetic accounting hotel", city: "Synthetic city", country: "Pakistan" } });
    const today = new Date("2035-01-01T22:00:00Z");
    const before = { tickets: await db.ticketSale.count(), journals: await db.journalEntry.count() };
    for (const [branchId, customerId, cancelled] of [[branch.id, customer.id, false], [foreign.id, outsider.id, false], [branch.id, customer.id, true]] as const) {
      await db.hotelBooking.create({ data: { bookingNumber: randomUUID(), hotelId: hotel.id, branchId, customerId, checkIn: today, checkOut: new Date("2035-01-03"), nights: 2, type: cancelled ? "CANCELLED" : "DEFINITE", cancelledAt: cancelled ? today : null } });
      await db.transportBooking.create({ data: { bookingNumber: randomUUID(), branchId, customerId, tripDate: today, status: cancelled ? "Cancelled" : "Reserved" } });
      await db.ticketSale.create({ data: { ticketNumber: randomUUID(), branchId, customerId, departureAt: today, status: cancelled ? "REISSUED" : "ISSUED" } });
    }
    await db.hotelBooking.create({ data: { bookingNumber: randomUUID(), hotelId: hotel.id, branchId: branch.id, customerId: customer.id, checkIn: new Date("2034-12-31"), checkOut: today, nights: 2, type: "DEFINITE" } });
    const result = await dailyOperations(db as never, actor, new Date("2035-01-01T20:00:00Z"));
    assert.deepEqual(result.metrics.map(m => m.value), [1, 1, 1, 1]);
    assert.equal(await db.ticketSale.count(), before.tickets + 3);
    assert.equal(await db.journalEntry.count(), before.journals);
  } finally { await db.$disconnect(); }
});
