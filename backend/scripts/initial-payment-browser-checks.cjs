"use strict";
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const path = require("node:path");

module.exports = async ({ context, page, origin, db, admin, outputDir }) => {
  // Existing synthetic receipt has already been examined by the parent journey.
  for (const receipt of await db.receipt.findMany({ where: { customerId: { not: null } } })) {
    const response = await context.request.post(`${origin}/api/v1/finance/receipts/${receipt.id}/review`, { data: { reviewed: true } });
    assert.equal(response.status(), 201);
  }
  await page.evaluate(() => localStorage.clear());
  const party = await db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Synthetic initial browser customer", branchId: admin.defaultBranchId } });
  const ticketNumber = randomUUID();
  async function fill() {
    await page.getByRole("button", { name: "Issue ticket", exact: true }).click();
    await page.locator(`select[name="customerId"] option[value="${party.id}"]`).waitFor({ state: "attached" });
    await page.locator('select[name="customerId"]').selectOption(party.id);
    for (const [name, value] of Object.entries({ ticketNumber, sector: "SYN-SYN", fare: "100", cost: "60", paidAmount: "30" })) await page.locator(`input[name="${name}"]`).fill(value);
    await page.locator('select[name="paymentMethod"]').selectOption("CASH");
    await page.locator('input[name="confirm"]').check();
  }
  await page.goto(origin + "/admin/manage/tickets");
  await fill();
  let key;
  await page.route("**/api/v1/workflows/tickets", async route => {
    key = route.request().headers()["idempotency-key"];
    assert.ok(key);
    assert.equal(route.request().postDataJSON().paymentMethod, "CASH");
    assert.equal((await route.fetch()).status(), 201);
    await route.abort("failed");
  });
  await page.getByRole("button", { name: "Confirm issue ticket", exact: true }).click();
  await page.getByText(/Operation outcome is uncertain/).waitFor();
  await page.unroute("**/api/v1/workflows/tickets");
  await page.reload();
  await fill();
  await page.getByText(/Saved receipt: ZAT-REC/).waitFor();
  const replay = page.waitForRequest(request => request.url().endsWith("/api/v1/workflows/tickets") && request.method() === "POST");
  await page.getByRole("button", { name: "Confirm issue ticket", exact: true }).click();
  assert.equal((await replay).headers()["idempotency-key"], key);
  await page.getByText("Operation completed. Review the refreshed record.", { exact: true }).waitFor();
  assert.equal(await db.ticketSale.count({ where: { ticketNumber } }), 1);
  const ticket = await db.ticketSale.findFirstOrThrow({ where: { ticketNumber } });
  assert.equal(ticket.paidAmount.toFixed(2), "30.00");
  assert.equal(await db.receipt.count({ where: { ticketSaleId: ticket.id } }), 1);
  await page.getByRole("button", { name: "I reviewed this saved receipt; allow a new payment", exact: true }).click();
  await page.getByText("Saved receipt reviewed. You may explicitly start a new payment.", { exact: true }).waitFor();
  await page.screenshot({ path: path.join(outputDir, "initial-payment-recovered.png"), fullPage: true });
};
