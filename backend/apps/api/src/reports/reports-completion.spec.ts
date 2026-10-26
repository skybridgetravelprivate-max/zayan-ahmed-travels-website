import assert from "node:assert/strict";
import test from "node:test";
import { ReportsService } from "./reports.service";
import { AccountingService } from "../finance/accounting.service";

test("settled posted receivables never fall back to unposted booking estimates", async () => {
  const service = new ReportsService({} as never, { arAp: async () => [] } as never);
  const result = await service.run("receivables", {});
  assert.deepEqual(result.rows, []);
  assert.equal(result.totals.debit, 0);
});

test("transport daily sales use selling value and exact decimal daily/report totals", async () => {
  const empty = { findMany: async () => [] };
  const db = { umrahBooking: empty, ticketSale: empty, hotelBooking: empty, starBooking: empty,
    transportBooking: { findMany: async () => [
      { tripDate: new Date("2050-01-01"), sellingPrice: "0.10", cost: "0.03", net: "0.07", paid: "0.01" },
      { tripDate: new Date("2050-01-02"), sellingPrice: "0.20", cost: "0.04", net: "0.16", paid: "0.02" },
    ] } };
  const result = await new ReportsService(db as never, {} as never).run("daily-sale", {});
  assert.equal(result.rows[0].sale, 0.1);
  assert.equal(result.rows[0].profit, 0.07);
  assert.equal(result.totals.sale, 0.3);
  assert.equal(result.rows[1].profit, 0.16);
});

test("party ledger running totals preserve exact cents across receipt and credit entries", async () => {
  const rows = [{ debit: "0.10", credit: "0" }, { debit: "0.20", credit: "0" }, { debit: "0", credit: "0.30" }].map(row => ({ ...row, journal: { date: new Date("2050-01-01"), entryNumber: "SYN", memo: "Synthetic" }, account: { code: "1300" } }));
  const db = { journalLine: { findMany: async () => rows } };
  const ledger = await new AccountingService(db as never, {} as never, {} as never).partyLedger("customer", "synthetic");
  assert.deepEqual(ledger.map(row => row.running), [0.1, 0.3, 0]);
});
