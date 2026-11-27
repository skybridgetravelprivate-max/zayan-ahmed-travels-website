import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { serviceVoucherInput } from "./service-vouchers";

const valid = { date: "2035-01-02", customerId: "customer", supplierId: "supplier", tax: "0.20", discount: "0.20", lines: [{ description: "Synthetic service", qty: 3, unitPrice: "0.20", cost: "0.10" }] };
test("service voucher uses exact quantity rates and independent supplier costs", () => {
  const input = serviceVoucherInput(valid);
  assert.equal(input.net.toFixed(2), "0.60");
  assert.equal(input.cost.toFixed(2), "0.30");
  assert.equal(input.lines[0].cost.div(input.lines[0].qty).toFixed(2), "0.10");
});
test("service voucher rejects missing billing/supplier accounts, invalid dates and quantities", () => {
  for (const body of [{ ...valid, supplierId: undefined }, { ...valid, customerId: undefined }, { ...valid, date: "2035-02-30" }, { ...valid, lines: [] }, { ...valid, lines: [{ ...valid.lines[0], qty: 1.5 }] }, { ...valid, lines: [{ description: "Missing buying", unitPrice: "1" }] }, { ...valid, discount: "99" }, { ...valid, paid: "0.60" }]) assert.throws(() => serviceVoucherInput(body));
});
