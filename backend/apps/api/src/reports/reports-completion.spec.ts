import assert from "node:assert/strict";
import test from "node:test";
import { ReportsService } from "./reports.service";
import { AccountingService } from "../finance/accounting.service";
import { ResourcesService } from "../resources/resources.service";
import { ExportController } from "./misc.controller";
import { invoiceLines, sumMoney } from "../finance/invoice-lines";

test("invoice totals preserve cents and reject invalid quantities, precision and range", () => {
  const rows = invoiceLines([{ description: "One", unitPrice: "0.10" }, { description: "Two", unitPrice: "0.20" }]);
  assert.equal(sumMoney(rows.map(row => row.amount)).toFixed(2), "0.30");
  for (const qty of [0, -1, 1.5, 2147483648]) assert.throws(() => invoiceLines([{ description: "Invalid", unitPrice: "1", qty }]));
  for (const unitPrice of ["0.001", "99999999999999999.00", "-1"]) assert.throws(() => invoiceLines([{ description: "Invalid", unitPrice }]));
});

test("trial balance and profit/loss each aggregate all accounts in one exact grouped query", async () => {
  let calls = 0;
  const service = new AccountingService({ chartOfAccount: { findMany: async () => [{ id: "income", code: "4100", name: "Income", type: "REVENUE" }, { id: "expense", code: "5100", name: "Expense", type: "EXPENSE" }] }, journalLine: { groupBy: async (query: { by: string[]; where: { journal: { status: { in: string[] } } } }) => {
    calls++; assert.deepEqual(query.by, ["accountId"]); assert.deepEqual(query.where.journal.status.in, ["POSTED", "REVERSED"]);
    return [{ accountId: "income", _sum: { credit: "0.30", debit: "0.00" } }, { accountId: "expense", _sum: { debit: "0.10", credit: "0.00" } }];
  } } } as never, {} as never, {} as never);
  const trial = await service.trialBalance(); assert.equal(calls, 1); assert.equal(trial.totals.credit, "0.30");
  const profit = await service.profitLoss(new Date("2099-01-01"), new Date("2099-12-31")); assert.equal(calls, 2); assert.equal(profit.net, "0.20");
});

test("authorized CSV export includes 101 and 5000 rows and rejects 5001 before sending", async () => {
  for (const size of [101, 5000, 5001]) {
    const records = Array.from({ length: size }, (_, i) => ({ id: String(i).padStart(5, "0"), fullName: i === 0 ? "=UNTRUSTED()" : `Synthetic ${i}` }));
    const resources = new ResourcesService({ customer: { count: async () => records.length, findMany: async (q: { skip: number; take: number }) => records.slice(q.skip, q.skip + q.take) } } as never, {} as never, {} as never);
    let sent = "";
    const run = new ExportController(resources).csv("customers", {}, { user: { id: "synthetic", isSuperAdmin: true, branchIds: [] } } as never, { setHeader: () => {}, send: (text: string) => { sent = text; } } as never);
    if (size > 5000) { await assert.rejects(run, { status: 400 }); assert.equal(sent, ""); }
    else { await run; assert.equal(sent.split("\r\n").length - 1, size); assert.ok(sent.includes("'=UNTRUSTED()")); }
  }
});

test("hotel room and approval-group report sales preserve fractional cents without binary residuals", async () => {
  const empty = { findMany: async () => [] };
  const room = (amount: string) => ({ sellingPrice: amount, roomTypeId: "synthetic-room", pax: [] });
  const segment = (rooms: ReturnType<typeof room>[]) => ({ hotel: { name: "Synthetic hotel", city: "Makkah" }, hotelId: "synthetic", booking: { bookingNumber: "SYN", customerId: "synthetic", customer: { fullName: "Synthetic" } }, rooms, checkIn: new Date("2050-01-01"), checkOut: new Date("2050-01-02"), nights: 1, status: "BOOKED" });
  const db = { hotelStaySegment: { findMany: async () => [segment([room("0.10"), room("0.20")]), segment([room("0.10")]), segment([room("0.20")])] }, hotelBooking: empty, ticketSale: empty, umrahBooking: { findMany: async () => [{status:"CONFIRMED",net:"0.10"},{status:"CONFIRMED",net:"0.20"}] } };
  const reports = new ReportsService(db as never, {} as never);
  const hotel = await reports.run("hotel-detail-3", {});
  assert.equal(hotel.rows[0].sale, "0.60");
  assert.equal(hotel.totals.sale, "0.60");
  const approvals = await reports.run("approval-booking", {});
  assert.equal(approvals.rows[0].sale, "0.30");
  assert.equal(approvals.totals.sale, "0.30");
});

test("settled posted receivables never fall back to unposted booking estimates", async () => {
  const service = new ReportsService({} as never, { arAp: async () => [] } as never);
  const result = await service.run("receivables", {});
  assert.deepEqual(result.rows, []);
  assert.equal(result.totals.debit, "0.00");
});

test("transport daily sales use selling value and exact decimal daily/report totals", async () => {
  const db = { $queryRaw: async (sql: TemplateStringsArray) => {
    assert.match(sql.join("?"), /GROUP BY day/);
    return [{ date: "2050-01-01", count: 1, sale: "0.10", cost: "0.03", paid: "0.01" }, { date: "2050-01-02", count: 1, sale: "0.20", cost: "0.04", paid: "0.02" }];
  } };
  const result = await new ReportsService(db as never, {} as never).run("daily-sale", {});
  assert.equal(result.rows[0].sale, "0.10");
  assert.equal(result.rows[0].profit, "0.07");
  assert.equal(result.totals.sale, "0.30");
  assert.equal(result.rows[1].profit, "0.16");
});

test("party ledger running totals preserve exact cents across receipt and credit entries", async () => {
  const rows = [{ debit: "0.10", credit: "0" }, { debit: "0.20", credit: "0" }, { debit: "0", credit: "0.30" }].map(row => ({ ...row, journal: { date: new Date("2050-01-01"), entryNumber: "SYN", memo: "Synthetic" }, account: { code: "1300" } }));
  const db = { journalLine: { findMany: async () => rows } };
  const ledger = await new AccountingService(db as never, {} as never, {} as never).partyLedger("customer", "synthetic");
  assert.deepEqual(ledger.map(row => row.running), ["0.10", "0.30", "0.00"]);
});
