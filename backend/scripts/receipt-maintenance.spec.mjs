import assert from "node:assert/strict";
import test from "node:test";
import gateway from "./hostinger-api-path.cjs";

test("maintenance blocks receipt mutations including review and route variants", () => {
  for (const url of ["/api/v1/finance/receipts", "/api/v1/finance/receipts/?x=1", "/API/V1/FINANCE/RECEIPTS", "/api/v1/finance/%72eceipts", "/api/v1/finance/receipts/request_test/review"]) {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) assert.equal(gateway.receiptWriteBlocked({ method, url }, "true"), true);
  }
  assert.equal(gateway.receiptWriteBlocked({ method: "POST", url: "/api/v1/finance/receipts" }, "typo"), true);
});

test("maintenance preserves receipt recovery, documents and unrelated routes", () => {
  for (const method of ["GET", "HEAD", "OPTIONS"]) assert.equal(gateway.receiptWriteBlocked({ method, url: "/api/v1/finance/receipts/submission/test_key" }, "true"), false);
  for (const url of ["/api/v1/pdf/receipt/id", "/api/account/bookings", "/api/v1/finance/payments", "/api/v1/finance/receipts-other"]) assert.equal(gateway.receiptWriteBlocked({ method: "POST", url }, "true"), false);
});

test("normal mode leaves mandatory retry and review enforcement to finance", () => {
  for (const flag of [undefined, "", "false"]) assert.equal(gateway.receiptWriteBlocked({ method: "POST", url: "/api/v1/finance/receipts" }, flag), false);
  assert.equal(gateway.receiptWriteBlocked({ method: "POST", url: "/%invalid" }, "true"), true);
});
