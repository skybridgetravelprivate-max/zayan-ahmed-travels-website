"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

module.exports = async ({ context, page, origin, db, booking, lead, password, otherEmail, issuedTicket, outputDir }) => {
  const customerId = booking.customerId, checks = [];
  await db.chartOfAccount.upsert({ where: { code: "4400" }, update: {}, create: { code: "4400", name: "Synthetic transport revenue", type: "REVENUE" } });
  const pick = async (name, value) => {
    await page.locator(`select[name="${name}"] option[value="${value}"]`).waitFor({ state: "attached" });
    await page.locator(`select[name="${name}"]`).selectOption(value);
  };
  await page.goto(origin + "/admin/manage/transport-bookings");
  await page.getByRole("button", { name: "New transport booking", exact: true }).click();
  await pick("customerId", customerId);
  for (const [name, value] of Object.entries({ pickup: "Synthetic airport", dropoff: "Synthetic hotel", tripDate: "2035-04-01T12:00", paxCount: "2", sellingPrice: "10.50", cost: "6.25", paid: "0" })) await page.locator(`[name="${name}"]`).fill(value);
  await page.locator('input[name="confirm"]').check();
  const created = page.waitForResponse(response => response.url().endsWith("/api/v1/workflows/transport") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Confirm new transport booking", exact: true }).click();
  assert.equal((await created).status(), 201);
  await page.getByText("Operation completed. Review the refreshed record.", { exact: true }).waitFor();
  const transport = await db.transportBooking.findFirstOrThrow({ where: { customerId, pickup: "Synthetic airport" }, orderBy: { createdAt: "desc" } });
  assert.equal(transport.sellingPrice.toFixed(2), "10.50");
  assert.equal(transport.cost.toFixed(2), "6.25");
  assert.equal(await db.transportVoucher.count({ where: { bookingId: transport.id } }), 1);
  const sale = await db.journalEntry.findFirstOrThrow({ where: { module: "transport", sourceId: transport.id, kind: "SALE" }, include: { lines: true } });
  assert.ok(sale.lines.some(line => line.partyId === customerId && line.debit.toFixed(2) === "10.50"));
  await page.goto(origin + `/admin/manage/transport-bookings?record=${transport.id}`);
  const transportPdfUrl = await page.getByRole("link", { name: "PDF with prices", exact: true }).getAttribute("href");
  const transportPdf = await context.request.get(origin + transportPdfUrl);
  assert.equal(transportPdf.status(), 200); assert.equal(transportPdf.headers()["cache-control"], "private, no-store");
  assert.equal((await transportPdf.body()).subarray(0, 5).toString(), "%PDF-");
  checks.push("actual transport create form preserves selling10.50/cost6.25, creates voucher and customer-tagged sale; saved-record PDF is private");

  await page.goto(origin + "/admin/manage/visa-applications");
  await page.getByRole("button", { name: "New record", exact: true }).click();
  await pick("customerId", customerId); await pick("branchId", booking.branchId);
  await page.locator('select[name="category"]').selectOption("VISIT");
  await page.locator('input[name="country"]').fill("Saudi Arabia");
  await page.locator('select[name="status"]').selectOption("DOCUMENT_PENDING");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("button", { name: "Edit record", exact: true }).waitFor();
  const visa = await db.visaApplication.findFirstOrThrow({ where: { customerId }, orderBy: { createdAt: "desc" } });
  await page.getByRole("button", { name: "Edit record", exact: true }).click();
  await page.locator('select[name="status"]').selectOption("APPROVED");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("button", { name: "Edit record", exact: true }).waitFor();
  const visaPdfUrl = await page.getByRole("link", { name: "Application PDF", exact: true }).getAttribute("href");
  const visaPdf = await context.request.get(origin + visaPdfUrl);
  assert.equal(visaPdf.status(), 200); assert.equal(visaPdf.headers()["cache-control"], "private, no-store");
  checks.push("actual visa create/edit forms retain owner/branch and current APPROVED status; application PDF is private; no external approval or settlement claimed");

  for (const [email, owns] of [[lead.email, true], [otherEmail, false]]) {
    const customerContext = await context.browser().newContext();
    try {
      const customerPage = await customerContext.newPage();
      const pageErrors = [];
      customerPage.on("pageerror", error => pageErrors.push(error.message));
      await customerPage.goto(origin + "/my-bookings");
      await customerPage.getByLabel("Email", { exact: true }).fill(email);
      await customerPage.getByLabel("Password", { exact: true }).fill(password);
      await customerPage.locator("form").getByRole("button", { name: /^Sign in$/i }).click();
      await customerPage.getByRole("button", { name: "Upcoming", exact: true }).waitFor();
      const response = await customerContext.request.get(origin + "/api/account/bookings");
      assert.equal(response.status(), 200);
      const bookingRows = (await response.json()).bookings;
      const references = bookingRows.map(row => row.reference);
      for (const reference of [issuedTicket.ticketNumber, transport.bookingNumber, visa.applicationNo]) assert.equal(references.includes(reference), owns);
      if (owns) {
        const pageResponse = await customerPage.goto(origin + "/my-bookings");
        const policy = pageResponse.headers()["content-security-policy-report-only"];
        assert.match(policy, /script-src .*'nonce-[A-Za-z0-9+/]+=*'/);
        const nonce = policy.match(/'nonce-([^']+)'/)[1];
        const jsonNonces = await customerPage.locator('script[type="application/ld+json"]').evaluateAll(scripts => scripts.map(script => script.nonce));
        assert.ok(jsonNonces.length > 0 && jsonNonces.every(value => value === nonce));
        assert.equal(pageResponse.headers()["strict-transport-security"], "max-age=300");
        assert.equal(bookingRows.find(row => row.reference === visa.applicationNo).travelDate, null);
        await customerPage.getByRole("button", { name: "Upcoming", exact: true }).click();
        await customerPage.getByRole("heading", { name: transport.bookingNumber, exact: true }).waitFor();
        await customerPage.getByRole("button", { name: "Completed", exact: true }).click();
        await customerPage.getByRole("heading", { name: visa.applicationNo, exact: true }).waitFor();
        await customerPage.locator("li").filter({ hasText: visa.applicationNo }).getByText("Date to be confirmed", { exact: true }).waitFor();
        await customerPage.getByRole("heading", { name: issuedTicket.ticketNumber, exact: true }).waitFor();
        await customerPage.screenshot({ path: path.join(outputDir, "customer-ticket-visa-completed.png"), fullPage: true });
        const navigation = [];
        for (const route of ["/", "/account", "/my-bookings"]) {
          const samples = [];
          for (let sample = 0; sample < 3; sample++) {
            await customerPage.goto(origin + route);
            await customerPage.waitForLoadState("load");
            samples.push(await customerPage.evaluate(() => { const entry = performance.getEntriesByType("navigation")[0]; return { durationMs: entry.duration, responseStartMs: entry.responseStart }; }));
          }
          navigation.push({ route, samples });
        }
        fs.writeFileSync(path.join(outputDir, "navigation-baseline.json"), JSON.stringify({ environment: "local synthetic, warm application, no production SLO claimed", navigation }, null, 2));
        const axe = process.env.ZAT_AXE_SCRIPT || path.resolve(process.env.ZAT_PLAYWRIGHT_MODULE, "../axe-core/axe.min.js");
        if (fs.existsSync(axe)) {
          await customerPage.addScriptTag({ path: axe });
          const audit = await customerPage.evaluate(async () => { const result = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }); return { violations: result.violations.map(item => ({ id: item.id, impact: item.impact, targets: item.nodes.map(node => node.target) })), incomplete: result.incomplete.map(item => item.id) }; });
          fs.writeFileSync(path.join(outputDir, "customer-accessibility.json"), JSON.stringify(audit, null, 2));
          assert.deepEqual(audit.violations, []);
          checks.push("selected customer booking page axe WCAG A/AA scan passed; incomplete/manual checks retained in evidence");
        }
        const pkg = await db.umrahPackage.create({ data: { packageNumber: require("node:crypto").randomUUID(), name: "Synthetic breadcrumb package", durationDays: 7, departureCity: "Islamabad", isPublic: true, status: "ACTIVE" } });
        await customerPage.goto(origin + "/umrah/" + pkg.id);
        const graphs = await customerPage.locator('script[type="application/ld+json"]').evaluateAll(scripts => scripts.map(script => JSON.parse(script.textContent)));
        const crumbs = graphs.find(graph => graph["@type"] === "BreadcrumbList");
        assert.equal(crumbs.itemListElement[2].name, pkg.name);
        assert.equal(pageErrors.length, 0, JSON.stringify(pageErrors));
        checks.push("built report-only nonce policy matches JSON-LD, opt-in HSTS appears, package breadcrumbs are truthful, and customer pages have no page errors");
      }
    } finally { await customerContext.close(); }
  }
  checks.push("two actual customer logins isolate issued ticket, transport and visa records; owner sees current Upcoming/Completed UI projections and unknown visa travel date");
  return checks;
};
