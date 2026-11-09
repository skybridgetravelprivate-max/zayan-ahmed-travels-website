import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { ReportsService } from "./reports.service";
import { ReportsController } from "./misc.controller";
import { reportCsv } from "./csv";

test("report CSV exports 251 rows once, quotes embedded quotes/newlines and neutralises formula text", async () => {
  const service = new ReportsService({} as never, {} as never);
  let reads = 0;
  Object.assign(service, { receivables: async () => { reads++; return Array.from({ length: 251 }, (_, i) => ({ party: i === 0 ? 'A,"B"\nC' : `Synthetic ${i}`, debit: "0.01" })); } });
  let output = "";
  await new ReportsController({} as never, service).run("receivables", { format: "csv" }, { setHeader() {}, send(value: string) { output = value; } } as never);
  assert.equal(reads, 1); assert.match(output, /Synthetic 250/); assert.match(output, /"A,""B""\nC"/);
  assert.match(reportCsv([{ text: "=1+1", negativeAmount: -1 }]), /"'=1\+1","-1"/);
});

test("oversized CSV rejects explicitly; invalid dates/report names/pagination cannot silently succeed", async () => {
  const service = new ReportsService({} as never, {} as never);
  Object.assign(service, { receivables: async () => Array.from({ length: 50001 }, () => ({})) });
  await assert.rejects(service.run("receivables", { format: "csv" }), /50000/);
  for (const q of [{ from: "2026-02-30" }, { from: "2026-12-10", to: "2026-01-01" }, { page: "NaN" }]) await assert.rejects(service.run("receivables", q));
  await assert.rejects(service.run("unknown", {}));
});

test("CSV serializes dates and exact decimals without adding JSON quotes", () => {
  const result = reportCsv([{
    date: new Date("2026-11-09T08:00:00.000Z"),
    account: "001234",
    amount: new Prisma.Decimal("99999999999999.99"),
    invalid: new Date(NaN),
  }]);
  assert.equal(result, '"date","account","amount","invalid"\r\n"2026-11-09T08:00:00.000Z","001234","99999999999999.99",""');
});

test("mixed stay representations include legacy rows once and keep hotels separate", async () => {
  const d = new Date("2050-01-01"), end = new Date("2050-01-02");
  let query: unknown;
  const hotel = { name: "Same hotel display name", city: "Makkah" };
  const db = { hotelStaySegment: { findMany: async () => [{ bookingId: "segmented", hotel, hotelId: "hotel-a", booking: { bookingNumber: "SYN-A", customerId: "a", customer: null }, rooms: [{ sellingPrice: "99999999999999.99", roomTypeId: "quad", pax: [] }], checkIn: d, checkOut: end, nights: 1, status: "Pending" }] }, hotelBooking: { findMany: async (args: unknown) => { query = args; return [{ id: "legacy", hotel: { ...hotel }, hotelId: "hotel-b", checkIn: d, checkOut: end, nights: 1, rooms: 2, net: "0.01", bookingNumber: "SYN-B" }]; } } };
  const service = new ReportsService(db as never, {} as never);
  const details = await service.run("hotel-detail-2", {});
  assert.equal(details.rows.length, 2); assert.equal(details.totals.rooms, 3);
  assert.deepEqual((query as { where: { id: unknown } }).where.id, { notIn: ["segmented"] });
  const amounts = await service.run("hotel-detail-3", {});
  // Large values must survive the full report aggregation contract as strings.
  assert.equal(amounts.totals.sale, "100000000000000.00");
});

test("approval report publishes its existing UTC booking-creation date basis and exact totals", async () => {
  const queries: unknown[] = [];
  const findMany = async (args: unknown) => { queries.push(args); return []; };
  const db = { umrahBooking: { findMany: async (args: unknown) => { queries.push(args); return [{ net: "99999999999999.99", status: "CONFIRMED" }]; } }, hotelBooking: { findMany }, ticketSale: { findMany } };
  const result = await new ReportsService(db as never, {} as never).run("approval-booking", { from: "2050-01-01", to: "2050-01-31" });
  assert.equal(result.dateBasis, "booking.createdAt (UTC)"); assert.equal(result.totals.sale, "99999999999999.99");
  assert.equal((queries[0] as { where: { createdAt: { lte: Date } } }).where.createdAt.lte.toISOString(), "2050-01-31T23:59:59.999Z");
});
