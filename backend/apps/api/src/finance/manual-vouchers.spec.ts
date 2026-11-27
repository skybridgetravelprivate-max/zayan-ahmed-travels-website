import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { voucherInput } from "./manual-vouchers";

const valid = { date: "2035-01-02", memo: "Synthetic voucher", lines: [{ accountId: "cash", debit: "900719925474099.01", credit: "0" }, { accountId: "equity", debit: "0", credit: "900719925474099.01" }] };
test("manual voucher preserves large decimal cents and normalizes equivalent inputs", () => {
  const result = voucherInput(valid);
  assert.equal(result.lines[0].debit, "900719925474099.01");
  assert.equal(result.lines[1].debit, "0.00");
});
test("manual voucher rejects invalid dates, unknown fields, unbalanced amounts and incomplete parties", () => {
  for (const body of [null, [], { ...valid, date: "2035-02-30" }, { ...valid, status: "POSTED" }, { ...valid, lines: [valid.lines[0]] }, { ...valid, lines: [valid.lines[0], { ...valid.lines[1], credit: "2" }] }, { ...valid, lines: [{ ...valid.lines[0], partyType: "customer" }, valid.lines[1]] }, { ...valid, lines: [{ ...valid.lines[0], debit: "-1" }, valid.lines[1]] }]) assert.throws(() => voucherInput(body));
});
