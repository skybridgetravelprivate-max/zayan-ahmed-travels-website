"use strict";
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

module.exports = async ({ context, page, origin, db, booking, lead, password, outputDir }) => {
  const before = { receipts: await db.receipt.count(), journals: await db.journalEntry.count(), status: (await db.umrahBooking.findUniqueOrThrow({ where: { id: booking.id } })).status };
  await page.goto(origin + `/admin/manage/umrah-bookings?record=${booking.id}`);
  await page.getByRole("button", { name: "Update booking stage", exact: true }).click();
  await page.locator('select[name="step"]').selectOption("Cancelled");
  await page.locator('input[name="confirm"]').check();
  const response = page.waitForResponse(r => r.url().endsWith(`/api/v1/umrah/${booking.id}/lifecycle`) && r.request().method() === "POST");
  await page.getByRole("button", { name: "Confirm update booking stage", exact: true }).click();
  assert.equal((await response).status(), 409);
  await page.getByText(/Cancellation requires accounting review/).waitFor();
  assert.deepEqual({ receipts: await db.receipt.count(), journals: await db.journalEntry.count(), status: (await db.umrahBooking.findUniqueOrThrow({ where: { id: booking.id } })).status }, before);
  assert.equal((await context.request.post(origin + "/api/v1/umrah", { data: { id: booking.id, workflowStep: "Cancelled" } })).status(), 403);
  await page.screenshot({ path: path.join(outputDir, "umrah-cancellation-review-hold.png"), fullPage: true });
  const unpaid = await db.umrahBooking.create({ data: { bookingNumber: randomUUID(), customerId: booking.customerId, branchId: booking.branchId, workflowStep: "Draft", status: "DRAFT" } });
  const endpoint = origin + `/api/v1/umrah/${unpaid.id}/lifecycle`;
  assert.equal((await context.request.post(endpoint, { data: { step: "Cancelled" } })).status(), 201);
  const audits = await db.auditLog.count({ where: { entityId: unpaid.id, action: "lifecycle" } });
  assert.equal((await context.request.post(endpoint, { data: { step: "Cancelled" } })).status(), 201);
  assert.equal(await db.auditLog.count({ where: { entityId: unpaid.id, action: "lifecycle" } }), audits);
  assert.equal((await context.request.post(endpoint, { data: { step: "Completed" } })).status(), 400);
  const pdf = await context.request.get(origin + `/api/v1/pdf/umrah-booking/${unpaid.id}`);
  assert.equal(pdf.status(), 200);assert.equal(pdf.headers()["cache-control"], "private, no-store");
  const bytes = await pdf.body();assert.equal(bytes.subarray(0,5).toString(), "%PDF-");
  fs.writeFileSync(path.join(outputDir, "cancelled-synthetic-booking.pdf"), bytes);
  const upload = await context.request.post(origin + `/api/v1/documents/upload?entityType=umrahBooking&entityId=${unpaid.id}`, { multipart: { file: { name: "synthetic.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\nSynthetic disabled-upload probe") } } });
  assert.equal(upload.status(), 503);
  const owner = await context.browser().newContext();
  try {
    const customerPage = await owner.newPage();
    await customerPage.goto(origin + "/my-bookings");
    await customerPage.getByLabel("Email", { exact: true }).fill(lead.email);
    await customerPage.getByLabel("Password", { exact: true }).fill(password);
    await customerPage.locator("form").getByRole("button", { name: /^Sign in$/i }).click();
    await customerPage.getByRole("heading", { name: unpaid.bookingNumber, exact: true }).waitFor();
    await customerPage.getByRole("button", { name: "Cancelled", exact: true }).click();
    await customerPage.getByRole("heading", { name: unpaid.bookingNumber, exact: true }).waitFor();
    await customerPage.screenshot({ path: path.join(outputDir, "customer-cancelled-booking.png"), fullPage: true });
  } finally { await owner.close(); }
};
