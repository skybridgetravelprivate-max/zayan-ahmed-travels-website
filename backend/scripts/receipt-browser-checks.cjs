"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { randomUUID } = require("node:crypto");

module.exports = async function browserChecks({ origin, outputDir, db, admin, outsider, password, lead, booking, receipt, otherEmail, otherBooking }) {
  const { chromium } = require(process.env.ZAT_PLAYWRIGHT_MODULE);
  const executablePath = process.env.ZAT_BROWSER_EXECUTABLE || "C:/Program Files/Google/Chrome/Application/chrome.exe";
  const profile = path.join(outputDir, "synthetic-browser-profile");
  const options = { executablePath, headless: true, viewport: { width: 1280, height: 900 }, acceptDownloads: true };
  let context = await chromium.launchPersistentContext(profile, options);
  context.setDefaultTimeout(20000);
  const results = [];
  async function staffLogin(page, user) {
    await page.goto(origin + "/admin/login");
    await page.getByLabel("Email or username", { exact: true }).fill(user.username);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Staff sign in", exact: true }).click();
    await page.waitForURL(origin + "/admin");
  }
  async function receiptForm(page) {
    await page.goto(origin + "/admin/manage/receipts");
    await page.getByRole("button", { name: "Record receipt", exact: true }).click();
    await page.getByRole("heading", { name: "Record receipt", exact: true }).waitFor();
  }
  async function fillReceipt(page) {
    await page.locator('select[name="bookingId"] option').filter({ hasText: booking.bookingNumber }).waitFor({ state: "attached" });
    await page.locator('select[name="bookingId"]').selectOption(booking.id);
    await page.locator('input[name="amount"]').fill("100.10");
    await page.locator('select[name="method"]').selectOption("CASH");
    await page.locator('input[name="confirm"]').check();
  }
  async function customerLogin(page, email) {
    await page.goto(origin + "/my-bookings");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.locator("form").getByRole("button", { name: /^Sign in$/i }).click();
  }
  try {
    const pageA = context.pages()[0] || await context.newPage();
    await staffLogin(pageA, admin);
    // Even with no browser key, the existing uncertain HTTP receipt blocks a fresh one.
    const blocked = await context.request.post(origin + "/api/v1/finance/receipts", { data: { bookingId: booking.id, amount: 250.25, method: "CASH" }, headers: { "Idempotency-Key": randomUUID() } });
    assert.equal(blocked.status(), 409);
    assert.equal((await context.request.post(origin + "/api/v1/finance/receipts", { data: { bookingId: booking.id, amount: 1, method: "CASH" } })).status(), 400);
    await pageA.goto(origin + `/admin/manage/receipts?record=${receipt.id}`);
    await pageA.getByRole("button", { name: "I reviewed this saved receipt; allow a new payment", exact: true }).click();
    await pageA.getByText("Saved receipt reviewed. You may explicitly start a new payment.", { exact: true }).waitFor();
    results.push("server rejects fresh/missing keys for an uncertain payment; explicit browser review unlocks a new intentional payment");

    const pageB = await context.newPage();
    await Promise.all([receiptForm(pageA), receiptForm(pageB)]);
    await Promise.all([fillReceipt(pageA), fillReceipt(pageB)]);
    const submittedKeys = [];
    let lostCommitted;
    const committed = new Promise(resolve => { lostCommitted = resolve; });
    await pageA.route("**/api/v1/finance/receipts", async route => {
      if (route.request().method() !== "POST") return route.continue();
      submittedKeys.push(route.request().headers()["idempotency-key"]);
      const response = await route.fetch();
      assert.equal(response.status(), 201);
      lostCommitted();
      await route.abort("failed");
    });
    pageB.on("request", request => { if (request.method() === "POST" && request.url().endsWith("/api/v1/finance/receipts")) submittedKeys.push(request.headers()["idempotency-key"]); });
    await Promise.all([pageA.getByRole("button", { name: "Confirm record receipt", exact: true }).click(), pageB.getByRole("button", { name: "Confirm record receipt", exact: true }).click()]);
    await committed;
    await pageA.getByText(/Operation outcome is uncertain/).waitFor();
    await pageB.getByText("Operation completed. Review the refreshed record.", { exact: true }).waitFor();
    assert.equal(submittedKeys.length, 2); assert.ok(submittedKeys[0]); assert.equal(submittedKeys[0], submittedKeys[1]);
    const lookup = await context.request.get(origin + `/api/v1/finance/receipts/submission/${submittedKeys[0]}`);
    assert.equal(lookup.status(), 200); assert.equal(lookup.headers()["cache-control"], "private, no-store");
    assert.equal(await db.receipt.count({ where: { bookingId: booking.id } }), 2);
    results.push("two actual tabs submit the same key; a committed response is deliberately lost; only one additional receipt exists");

    await pageA.unroute("**/api/v1/finance/receipts");
    await pageA.reload(); await receiptForm(pageA); await fillReceipt(pageA);
    await pageA.getByRole("button", { name: "Confirm record receipt", exact: true }).click();
    await pageA.getByText("Operation completed. Review the refreshed record.", { exact: true }).waitFor();
    assert.equal(await db.receipt.count({ where: { bookingId: booking.id } }), 2);
    await context.close();
    context = await chromium.launchPersistentContext(profile, options);
    context.setDefaultTimeout(20000);
    const pageC = context.pages()[0] || await context.newPage();
    await pageC.goto(origin + "/admin/manage/receipts");
    if (new URL(pageC.url()).pathname === "/admin/login") {
      await staffLogin(pageC, admin);
      results.push("browser reopen required real staff reauthentication; persisted receipt key recovered without replacement");
    }
    await receiptForm(pageC);
    await pageC.getByText(/Saved receipt: ZAT-REC/).waitFor();
    await fillReceipt(pageC);
    await pageC.getByRole("button", { name: "Confirm record receipt", exact: true }).click();
    await pageC.getByText("Operation completed. Review the refreshed record.", { exact: true }).waitFor();
    assert.equal(await db.receipt.count({ where: { bookingId: booking.id } }), 2);
    await pageC.screenshot({ path: path.join(outputDir, "receipt-recovered.png"), fullPage: true });
    results.push("actual page reload and full browser closure/reopen recover the saved submission and do not add payments");
    const bypass = await context.request.post(origin + "/api/v1/finance/receipts", { data: { bookingId: booking.id, amount: 100.10, method: "CASH" }, headers: { "Idempotency-Key": randomUUID() } });
    assert.equal(bypass.status(), 409);
    assert.equal((await context.request.post(origin + "/api/v1/finance/receipts", { data: { bookingId: booking.id, amount: 1, method: "CASH" }, headers: { "Idempotency-Key": randomUUID(), Origin: "https://untrusted.example.test" } })).status(), 403);
    const current = await db.umrahBooking.findUniqueOrThrow({ where: { id: booking.id } });
    assert.equal(current.paid.toFixed(2), "350.35"); assert.equal(current.balance.toFixed(2), "659.65");

    await pageC.goto(origin + `/admin/manage/umrah-bookings?record=${booking.id}`);
    const pdfResponse = context.waitForEvent("response", { predicate: response => response.url().includes(`/api/v1/pdf/umrah-booking/${booking.id}`) });
    await pageC.getByRole("link", { name: "PDF with prices", exact: true }).click();
    const pdf = await pdfResponse;
    assert.equal(pdf.status(), 200); assert.ok(pdf.headers()["content-type"].includes("application/pdf"));
    assert.equal(pdf.headers()["cache-control"], "private, no-store");
    results.push("actual staff document link passes through the local gateway and returns a private PDF");

    const browser = context.browser();
    const owner = await browser.newContext();
    const ownerPage = await owner.newPage();
    await customerLogin(ownerPage, lead.email);
    await ownerPage.getByText("Date to be confirmed", { exact: true }).waitFor();
    await ownerPage.getByRole("heading", { name: booking.bookingNumber, exact: true }).waitFor();
    await ownerPage.screenshot({ path: path.join(outputDir, "undated-owner-booking.png"), fullPage: true });
    const ownerRows = await owner.request.get(origin + "/api/account/bookings?website_customer_id=forged-other-customer");
    assert.equal(ownerRows.status(), 200); const ownData = await ownerRows.json();
    assert.match(ownerRows.headers()["cache-control"] || "", /private/);
    assert.match(ownerRows.headers()["cache-control"] || "", /no-store/);
    assert.deepEqual(ownData.bookings.map(row => row.reference), [booking.bookingNumber]);
    assert.equal(ownData.bookings[0].travelDate, null);
    const forbidden = await ownerPage.goto(origin + `/api/v1/pdf/umrah-voucher/${booking.id}`);
    assert.equal(forbidden.status(), 401);
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await customerLogin(otherPage, otherEmail);
    await otherPage.getByRole("heading", { name: otherBooking.bookingNumber, exact: true }).waitFor();
    assert.ok(!(await otherPage.locator("body").innerText()).includes(booking.bookingNumber));
    const otherRows = await other.request.get(origin + `/api/account/bookings?website_customer_id=${booking.customerId}`);
    assert.equal(otherRows.status(), 200); assert.deepEqual((await otherRows.json()).bookings.map(row => row.reference), [otherBooking.bookingNumber]);
    // Alternate authenticated accounts at the identical URL through the proxy.
    // A shared-cache key that omits cookies must never reuse another customer's body.
    for (const [actor, expected] of [[owner, booking.bookingNumber], [other, otherBooking.bookingNumber], [owner, booking.bookingNumber]]) {
      const response = await actor.request.get(origin + "/api/account/bookings");
      assert.equal(response.status(), 200);
      assert.match(response.headers()["cache-control"] || "", /private/);
      assert.match(response.headers()["cache-control"] || "", /no-store/);
      assert.equal(Number(response.headers().age || 0), 0);
      assert.deepEqual((await response.json()).bookings.map(row => row.reference), [expected]);
    }
    results.push("authenticated proxy cache checks: identical booking URL alternates owner/other/owner with private/no-store and no positive Age; each body remains isolated");
    await otherPage.screenshot({ path: path.join(outputDir, "other-customer-isolation.png"), fullPage: true });
    const staffOther = await browser.newContext();
    const staffOtherPage = await staffOther.newPage();
    await staffLogin(staffOtherPage, outsider);
    const foreignPdf = await staffOtherPage.goto(origin + `/api/v1/pdf/umrah-voucher/${booking.id}`);
    assert.equal(foreignPdf.status(), 404);
    assert.equal((await staffOther.request.post(origin + `/api/v1/finance/receipts/${receipt.id}/review`, { data: { reviewed: true } })).status(), 403);
    await ownerPage.goto(origin + "/account");
    await ownerPage.getByRole("heading", { name: "Need help with an inquiry?", exact: true }).waitFor();
    assert.ok(!(await ownerPage.locator("body").innerText()).includes("Demo Traveller"));
    for (const width of [390, 1280]) {
      await ownerPage.setViewportSize({ width, height: 844 });
      await ownerPage.getByRole("button", { name: "Support", exact: true }).click();
      assert.equal(await ownerPage.getByRole("link", { name: "Contact agency", exact: true }).getAttribute("href"), "/contact");
      assert.ok(await ownerPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Account layout must fit mobile and desktop");
      await ownerPage.screenshot({ path: path.join(outputDir, `account-${width}.png`), fullPage: true });
      await ownerPage.getByRole("button", { name: "Support", exact: true }).click();
    }
    const guest = await browser.newContext();
    const guestPage = await guest.newPage();
    await guestPage.goto(origin + "/account");
    assert.ok(!(await guestPage.locator("body").innerText()).includes("Demo Traveller"));
    await guestPage.getByRole("heading", { name: "Create an account", exact: true }).waitFor();
    await guest.close();
    results.push("real account identity and support link render at mobile/desktop sizes; signed-out account has no fabricated profile");
    await owner.close(); await other.close(); await staffOther.close();
    await require("./initial-payment-browser-checks.cjs")({ context, page: pageC, origin, db, admin, outputDir });
    results.push("initial ticket payment sends explicit method and durable key; lost response and reload replay one ticket/receipt; recovery and review work on the ticket page");
    results.push("two verified customer logins display only their own bookings; forged selectors ignored; owner sees the pending date; customer/foreign staff document requests return 401/404; foreign receipt review denied (403)");
    const result = { status: "passed", browser: await browser.version(), checks: results, receiptCount: 2, paid: "350.35", balance: "659.65", syntheticOnly: true };
    fs.writeFileSync(path.join(outputDir, "browser-result.json"), JSON.stringify(result, null, 2));
    return result;
  } finally { await context?.close(); }
};
