"use strict";

// Opt-in integration proof. Requires a built temporary project and disposable PG17.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const net = require("node:net");
const { pathToFileURL } = require("node:url");
const { randomUUID, randomBytes, createHash } = require("node:crypto");
const { spawn } = require("node:child_process");
const root = path.resolve(__dirname, "../..");
const databaseUrl = process.env.ZAT_SYNTHETIC_DATABASE_URL;
if (!databaseUrl) throw Error("Set ZAT_SYNTHETIC_DATABASE_URL to a disposable local PG17 database");
const target = new URL(databaseUrl);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(target.hostname));
assert.match(target.pathname, /^\/zat_synthetic_[a-z0-9_]+$/);

function createSmtpCapture() {
  const messages = [];
  const sockets = new Set();
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.setEncoding("utf8");
    let pending = "";
    let message = "";
    let inData = false;
    socket.write("220 synthetic.local ESMTP\r\n");
    socket.on("data", chunk => {
      pending += chunk;
      let end;
      while ((end = pending.indexOf("\r\n")) !== -1) {
        const line = pending.slice(0, end);
        pending = pending.slice(end + 2);
        if (inData) {
          if (line === ".") {
            messages.push(message);
            message = "";
            inData = false;
            socket.write("250 queued\r\n");
          } else message += `${line}\r\n`;
          continue;
        }
        const command = line.split(" ", 1)[0].toUpperCase();
        if (command === "EHLO" || command === "HELO") socket.write("250-synthetic.local\r\n250 SIZE 10485760\r\n");
        else if (command === "MAIL" || command === "RCPT" || command === "RSET") socket.write("250 OK\r\n");
        else if (command === "DATA") { inData = true; socket.write("354 end with dot\r\n"); }
        else if (command === "QUIT") { socket.write("221 bye\r\n"); socket.end(); }
        else socket.write("250 OK\r\n");
      }
    });
    socket.on("close", () => sockets.delete(socket));
  });
  return {
    messages,
    start: () => new Promise(resolve => server.listen(0, "127.0.0.1", resolve)),
    port: () => server.address().port,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise(resolve => server.close(resolve));
    },
  };
}

async function serve() {
  assert.equal(process.env.DATABASE_URL, databaseUrl);
  const port = Number(process.env.ZAT_SYNTHETIC_HTTP_PORT);
  const { createNestApp } = require("../apps/api/dist/create-app.js");
  const { isApiPathname } = require("./hostinger-api-path.cjs");
  const app = await createNestApp();
  const api = app.getHttpAdapter().getInstance();
  const next = require(path.join(root, "node_modules/next"))({ dev: false, dir: root, hostname: "127.0.0.1", port });
  await next.prepare();
  const handle = next.getRequestHandler();
  let cmsOutage = false;
  const server = http.createServer((request, response) => {
    if (process.env.HSTS_ENABLED === "true") response.setHeader("Strict-Transport-Security", "max-age=300");
    if (cmsOutage && request.url.startsWith("/api/public/website/pages")) { response.writeHead(503); response.end(); return; }
    return isApiPathname(request.url.split("?")[0]) ? api(request, response) : handle(request, response);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const upstreamPort = server.address().port;
  // Exercise real header/cookie/PDF forwarding, not only gateway path classification.
  const proxy = http.createServer((request, response) => {
    const upstream = http.request({ hostname: "127.0.0.1", port: upstreamPort, path: request.url, method: request.method, headers: { ...request.headers, "x-forwarded-host": request.headers.host, "x-forwarded-proto": "http", "x-forwarded-for": "127.0.0.1" } }, incoming => {
      response.writeHead(incoming.statusCode, incoming.headers); incoming.pipe(response);
    });
    upstream.on("error", () => { if (!response.headersSent) response.writeHead(502); response.end(); });
    request.pipe(upstream);
  });
  await new Promise(resolve => proxy.listen(port, "127.0.0.1", resolve));
  process.send?.({ ready: true });
  process.on("message", async message => {
    if (message && typeof message === "object" && typeof message.cmsOutage === "boolean") { cmsOutage = message.cmsOutage; process.send?.({ cmsOutage }); return; }
    if (message !== "stop") return;
    proxy.closeAllConnections(); proxy.close(); server.closeAllConnections(); server.close(); await app.close(); await next.close(); process.disconnect?.();
  });
}

async function journey() {
  const { PrismaClient, Prisma } = require("@prisma/client");
  const bcrypt = require("bcryptjs");
  const { receiptRetryKey, clearReceiptRetry } = await import(pathToFileURL(path.join(root, "src/lib/receipt-retry.ts")).href);
  const db = new PrismaClient({ datasourceUrl: databaseUrl });
  let child;
  const checks = [];
  const outputDir = process.env.ZAT_SYNTHETIC_HTTP_OUTPUT || path.join(require("node:os").tmpdir(), "zat-http-journey");
  fs.mkdirSync(outputDir, { recursive: true });
  const log = fs.openSync(path.join(outputDir, "server.log"), "w");
  const portServer = http.createServer();
  await new Promise(resolve => portServer.listen(0, "127.0.0.1", resolve));
  const port = portServer.address().port;
  await new Promise(resolve => portServer.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const smtp = createSmtpCapture();
  await smtp.start();
  const cookieJars = new Map();
  async function request(route, { actor = "anonymous", method = "GET", body, headers = {} } = {}) {
    const response = await fetch(origin + route, { method, redirect: "manual", headers: { ...(cookieJars.get(actor) ? { Cookie: cookieJars.get(actor) } : {}), ...(body ? { "Content-Type": "application/json", Origin: origin } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) cookieJars.set(actor, cookies.map(cookie => cookie.split(";")[0]).join("; "));
    return response;
  }
  async function json(route, options, status = 200) {
    const response = await request(route, options);
    assert.equal(response.status, status, `${options?.method || "GET"} ${route}`);
    return response.json();
  }
  try {
    const [server] = await db.$queryRaw`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(server.version >= 170000 && server.version < 180000);
    const tag = randomUUID().replaceAll("-", "");
    const password = `Synthetic-${randomBytes(12).toString("hex")}!`;
    const hash = await bcrypt.hash(password, 10);
    const branch = await db.branch.create({ data: { code: tag, name: "Synthetic HTTP branch" } });
    const otherBranch = await db.branch.create({ data: { code: randomUUID(), name: "Other synthetic HTTP branch" } });
    const adminRole = await db.role.upsert({ where: { name: "SUPER_ADMIN" }, update: {}, create: { name: "SUPER_ADMIN" } });
    const scopedRole = await db.role.create({ data: { name: `Synthetic-${tag}` } });
    for (const code of ["quotation.create", "quotation.edit", "quotation.convert", "booking.view", "document.view", "account.post"]) {
      const permission = await db.permission.upsert({ where: { code }, update: {}, create: { code } });
      await db.rolePermission.create({ data: { roleId: scopedRole.id, permissionId: permission.id } });
    }
    const admin = await db.user.create({ data: { email: `${tag}@example.test`, username: tag, fullName: "Synthetic HTTP administrator", passwordHash: hash, defaultBranchId: branch.id, roles: { create: { roleId: adminRole.id } } } });
    const outsider = await db.user.create({ data: { email: `${tag}-staff@example.test`, username: `${tag}-staff`, fullName: "Synthetic foreign staff", passwordHash: hash, defaultBranchId: otherBranch.id, roles: { create: { roleId: scopedRole.id } } } });
    const branchAdminRole = await db.role.create({ data: { name: `SyntheticAdmin-${tag}` } });
    const branchAdminPermissions = await Promise.all(["audit.view", "account.adjust", "account.post", "account.create", "account.view"].map(code => db.permission.upsert({ where: { code }, update: {}, create: { code } })));
    await db.rolePermission.createMany({ data: branchAdminPermissions.map(permission => ({ roleId: branchAdminRole.id, permissionId: permission.id })) });
    const branchAdmin = await db.user.create({ data: { email: `${tag}-admin@example.test`, username: `${tag}-admin`, fullName: "Synthetic branch administrator", passwordHash: hash, defaultBranchId: branch.id, roles: { create: { roleId: branchAdminRole.id } }, branches: { create: { branchId: branch.id } } } });
    for (const [code, type] of [["1100", "ASSET"], ["1300", "ASSET"], ["2100", "LIABILITY"], ["4100", "REVENUE"], ["4200", "REVENUE"], ["4600", "REVENUE"], ["5100", "EXPENSE"]]) await db.chartOfAccount.upsert({ where: { code }, update: {}, create: { code, name: `Synthetic ${code}`, type } });
    const lead = await db.lead.create({ data: { leadNumber: randomUUID(), fullName: "Synthetic HTTP traveler", mobile: "+923000000000", email: `${tag}-customer@example.test`, adults: 3, budget: 1000.03, branchId: branch.id } });
    const environment = {};
    for (const key of ["SystemRoot", "WINDIR", "TEMP", "TMP", "PATH", "USERPROFILE", "LOCALAPPDATA"]) if (process.env[key]) environment[key] = process.env[key];
    Object.assign(environment, { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", DATABASE_URL: databaseUrl, ZAT_SYNTHETIC_DATABASE_URL: databaseUrl, ZAT_SYNTHETIC_HTTP_PORT: String(port), JWT_SECRET: randomBytes(32).toString("hex"), JWT_REFRESH_SECRET: randomBytes(32).toString("hex"), CUSTOMER_BOOKINGS_INTERNAL_TOKEN: randomBytes(32).toString("hex"), APP_URL: origin, SITE_URL: "https://customer-recovery.example.test", API_URL: origin, CRM_API_URL: origin, SMTP_HOST: "127.0.0.1", SMTP_PORT: String(smtp.port()), SMTP_SECURE: "false", COOKIE_SECURE: "false" });
    environment.HSTS_ENABLED = "true";
    child = spawn(process.execPath, [__filename, "--serve"], { cwd: root, env: environment, stdio: ["ignore", log, log, "ipc"], windowsHide: true });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("Synthetic gateway startup timed out")), 45000);
      child.once("message", message => { clearTimeout(timer); assert.equal(message.ready, true); resolve(); });
      child.once("exit", () => { clearTimeout(timer); reject(Error("Synthetic gateway failed to start; inspect local server.log")); });
    });
    const rendering = [];
    async function samplePage(label) { const started = performance.now(); const response = await fetch(origin + "/"); await response.text(); assert.equal(response.status, 200); rendering.push({ label, elapsedMs: performance.now() - started }); }
    await samplePage("initial public request after process startup");
    await samplePage("warm public request");
    if (process.env.ZAT_COMMUNICATION_BROWSER_ONLY === "true") {
      assert.ok(process.env.ZAT_PLAYWRIGHT_MODULE, "Focused browser verification requires Playwright");
      const { chromium } = require(process.env.ZAT_PLAYWRIGHT_MODULE);
      const browser = await chromium.launch({ executablePath: process.env.ZAT_BROWSER_EXECUTABLE || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      try {
        const page = await context.newPage(); page.setDefaultTimeout(20000);
        await page.goto(origin + "/admin/login/super-admin");
        await page.getByLabel("Email or username", { exact: true }).fill(admin.username);
        await page.getByLabel("Password", { exact: true }).fill(password);
        await page.getByRole("button", { name: "Super Admin sign in", exact: true }).click();
        await page.waitForURL(origin + "/admin");
        const check = await require("./communication-recovery-browser-checks.cjs")({ context, page, origin, db, admin, outsider, password, outputDir });
        assert.equal(smtp.messages.length, 0);
        fs.writeFileSync(path.join(outputDir, "communication-result.json"), JSON.stringify({ status: "passed", check, syntheticOnly: true, productionChanges: false }, null, 2));
        console.log("Focused communication browser checks passed; no SMTP message sent.");
      } catch (error) {
        const page = context.pages()[0];
        if (page) { fs.writeFileSync(path.join(outputDir, "communication-recovery-failure.html"), await page.content()); await page.screenshot({ path: path.join(outputDir, "communication-recovery-failure.png"), fullPage: true }); }
        throw error;
      } finally { await context.close(); await browser.close(); }
      return;
    }
    await json("/api/auth/login", { actor: "staff", method: "POST", body: { identifier: admin.username, password } }, 201);
    await json("/api/auth/login", { actor: "outsider", method: "POST", body: { identifier: outsider.username, password } }, 201);
    await json("/api/auth/login", { actor: "branch-admin", method: "POST", body: { identifier: branchAdmin.username, password } }, 201);
    const auditMarker = `synthetic-http-${tag}`;
    await db.auditLog.create({ data: { userId: admin.id, action: "AUTHZ_HTTP_REGRESSION", entity: "SyntheticTest", entityId: auditMarker } });
    const deniedAudit = await request(`/api/v1/admin/audit?q=${encodeURIComponent(auditMarker)}`, { actor: "branch-admin" });
    assert.equal(deniedAudit.status, 403);
    const deniedAuditBody = await deniedAudit.json();
    assert.equal(Array.isArray(deniedAuditBody), false);
    assert.ok(!JSON.stringify(deniedAuditBody).includes(auditMarker));
    const allowedAudit = await json(`/api/v1/admin/audit?q=${encodeURIComponent(auditMarker)}`, { actor: "staff" });
    assert.ok(allowedAudit.some(row => row.entityId === auditMarker));
    const cashAccount = await db.chartOfAccount.findUniqueOrThrow({ where: { code: "1100" } });
    const receivableAccount = await db.chartOfAccount.findUniqueOrThrow({ where: { code: "1300" } });
    const deniedJournalMemo = `Synthetic denied journal ${tag}`;
    const journalLines = [
      { accountId: cashAccount.id, debit: 25.25, credit: 0 },
      { accountId: receivableAccount.id, debit: 0, credit: 25.25 },
    ];
    const journalCountBefore = await db.journalEntry.count({ where: { memo: deniedJournalMemo } });
    const deniedJournal = await request("/api/v1/admin/manual-journal", {
      actor: "branch-admin",
      method: "POST",
      body: { memo: deniedJournalMemo, reason: "Synthetic authorization check", lines: journalLines },
    });
    assert.equal(deniedJournal.status, 403);
    assert.equal((await request("/api/v1/finance/cash-vouchers", { actor: "branch-admin", method: "POST", body: { date: "2035-01-02", memo: deniedJournalMemo, lines: journalLines } })).status, 403);
    assert.equal((await request("/api/v1/finance/cash-vouchers", { method: "POST", body: {} })).status, 401);
    const deniedVoucher = await request("/api/v1/finance/vouchers", { actor: "branch-admin", method: "POST", body: { date: "2035-01-02", memo: deniedJournalMemo, lines: journalLines } });
    assert.equal(deniedVoucher.status, 403);
    assert.equal((await request("/api/v1/finance/vouchers/submission/synthetic-denied-key", { actor: "branch-admin" })).status, 403);
    assert.equal(await db.journalEntry.count({ where: { memo: deniedJournalMemo } }), journalCountBefore);
    const allowedJournal = await request("/api/v1/admin/manual-journal", {
      actor: "staff",
      method: "POST",
      body: { memo: `Synthetic allowed journal ${tag}`, reason: "Synthetic authorization check", lines: journalLines },
    });
    assert.equal(allowedJournal.status, 201);
    const allowedJournalBody = await allowedJournal.json();
    const persistedJournal = await db.journalEntry.findUniqueOrThrow({ where: { id: allowedJournalBody.id }, include: { lines: true } });
    assert.equal(persistedJournal.status, "POSTED");
    assert.equal(persistedJournal.lines.reduce((sum, line) => sum.plus(line.debit).minus(line.credit), new Prisma.Decimal(0)).toFixed(2), "0.00");
    checks.push("real HTTP auth: branch admin with audit.view/account.adjust receives 403 and no audit data/journal write; Super Admin reads synthetic audit row and posts a balanced journal");

    const invoiceCustomer = await db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Synthetic HTTP invoice customer", branchId: branch.id } });
    const invoiceSupplier = await db.supplier.create({ data: { name: "Synthetic HTTP invoice supplier" } });
    const invoiceBody = { date: "2035-01-02", branchId: branch.id, customerId: invoiceCustomer.id, supplierId: invoiceSupplier.id, lines: [{ description: "Synthetic invoice service", qty: 2, unitPrice: "10.25", cost: "6.20" }] };
    const invoiceKey = randomUUID();
    assert.equal((await request("/api/v1/finance/service-vouchers", { actor: "branch-admin", method: "POST", body: invoiceBody, headers: { "Idempotency-Key": invoiceKey } })).status, 403);
    assert.equal((await request("/api/v1/finance/service-vouchers", { method: "POST", body: invoiceBody, headers: { "Idempotency-Key": invoiceKey } })).status, 401);
    const invoice = await json("/api/v1/finance/service-vouchers", { actor: "staff", method: "POST", body: invoiceBody, headers: { "Idempotency-Key": invoiceKey } }, 201);
    const invoiceRetry = await json("/api/v1/finance/service-vouchers", { actor: "staff", method: "POST", body: invoiceBody, headers: { "Idempotency-Key": invoiceKey } }, 201);
    assert.equal(invoiceRetry.id, invoice.id);
    assert.equal(new Prisma.Decimal(invoice.net).toFixed(2), "20.50");
    assert.equal(new Prisma.Decimal(invoice.cost).toFixed(2), "12.40");
    assert.equal(new Prisma.Decimal(invoice.lines[0].unitCost).toFixed(2), "6.20");
    assert.equal((await request("/api/v1/finance/service-vouchers", { actor: "staff", method: "POST", body: { ...invoiceBody, notes: "Changed" }, headers: { "Idempotency-Key": invoiceKey } })).status, 409);
    const invoicePaymentKey = randomUUID();
    const invoiceReceipt = await json("/api/v1/finance/receipts", { actor: "staff", method: "POST", body: { serviceInvoiceId: invoice.id, amount: "20.50", method: "CASH" }, headers: { "Idempotency-Key": invoicePaymentKey } }, 201);
    assert.equal(invoiceReceipt.serviceInvoiceId, invoice.id);
    assert.equal((await db.serviceInvoice.findUniqueOrThrow({ where: { id: invoice.id } })).paid.toFixed(2), "20.50");
    assert.equal(await db.receipt.count({ where: { serviceInvoiceId: invoice.id } }), 1);
    await json(`/api/v1/finance/receipts/${invoiceReceipt.id}/review`, { actor: "staff", method: "POST", body: { reviewed: true } }, 201);
    for (const mode of ["INCLUDED", "EXCLUDED"]) {
      const pdf = await request(`/api/v1/pdf/service-invoice/${invoice.id}?mode=${mode}`, { actor: "staff" });
      assert.equal(pdf.status, 200); assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,5).toString(), "%PDF-");
    }
    checks.push("service invoice HTTP posting/retry, independent supplier unit costs, linked cash receipt/review and both PDF modes pass; scoped/anonymous creation denied");
    assert.equal((await request("/api/v1/crm/quotations")).status, 401);
    checks.push("real staff login cookies; anonymous staff access denied (401)");
    const quote = await json(`/api/v1/crm/leads/${lead.id}/quotation`, { actor: "staff", method: "POST", body: {} }, 201);
    await json(`/api/v1/crm/quotations/${quote.id}/items`, { actor: "staff", method: "POST", body: { description: "Synthetic extra", quantity: 2, sellingPrice: 10, cost: 20 } }, 201);
    const edited = await json(`/api/v1/crm/quotations/${quote.id}`, { actor: "staff", method: "PATCH", body: { discount: 20.03, tax: 10 } });
    assert.equal(Number(edited.net), 1010);
    assert.equal((await request(`/api/v1/crm/quotations/${quote.id}`, { actor: "outsider", method: "PATCH", body: { tax: 1 } })).status, 404);
    const booking = await json(`/api/v1/workflows/quotations/${quote.id}/convert-booking`, { actor: "staff", method: "POST", body: {} }, 201);
    const repeat = await json(`/api/v1/workflows/quotations/${quote.id}/convert-booking`, { actor: "staff", method: "POST", body: {} }, 201);
    assert.equal(booking.id, repeat.id); assert.equal(Number(booking.net), 1010); assert.equal(booking.departureDate, null);
    checks.push("quotation edits reconcile to 1010.00; foreign branch denied (404); repeated conversion returns one undated booking");
    const pendingRows = new Map();
    const storage = rows => ({ getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, value), removeItem: key => rows.delete(key) });
    const payment = { bookingId: booking.id, amount: 250.25, method: "CASH" };
    const key = await receiptRetryKey(storage(pendingRows), admin.username, payment);
    // Server commits, but the client never handles/acknowledges the response.
    const lost = await request("/api/v1/finance/receipts", { actor: "staff", method: "POST", body: payment, headers: { "Idempotency-Key": key } });
    assert.equal(lost.status, 201); await lost.arrayBuffer();
    const reloadedRows = new Map(JSON.parse(JSON.stringify([...pendingRows])));
    const reloadedKey = await receiptRetryKey(storage(reloadedRows), admin.username, payment);
    assert.equal(reloadedKey, key);
    const receipt = await json("/api/v1/finance/receipts", { actor: "staff", method: "POST", body: payment, headers: { "Idempotency-Key": reloadedKey } }, 201);
    await assert.rejects(receiptRetryKey(storage(reloadedRows), admin.username, { ...payment, amount: 251 }), /unconfirmed/);
    assert.equal((await request("/api/v1/finance/receipts", { actor: "staff", method: "POST", body: { ...payment, amount: 251 }, headers: { "Idempotency-Key": key } })).status, 409);
    assert.equal((await request("/api/v1/finance/receipts", { actor: "outsider", method: "POST", body: payment })).status, 403);
    clearReceiptRetry(storage(reloadedRows), admin.username);
    const paid = await db.umrahBooking.findUniqueOrThrow({ where: { id: booking.id } });
    assert.equal(paid.paid.toFixed(2), "250.25"); assert.equal(paid.balance.toFixed(2), "759.75");
    assert.equal(await db.receipt.count({ where: { bookingId: booking.id } }), 1);
    const journals = await db.journalEntry.findMany({ where: { sourceId: booking.id }, include: { lines: { include: { account: true } } } });
    for (const journal of journals) assert.equal(journal.lines.reduce((sum, line) => sum.plus(line.debit).minus(line.credit), new Prisma.Decimal(0)).toFixed(2), "0.00");
    assert.equal(journals.flatMap(j => j.lines).filter(l => l.account.code === "1300").reduce((sum, l) => sum.plus(l.debit).minus(l.credit), new Prisma.Decimal(0)).toFixed(2), "759.75");
    checks.push("lost-response/reload retry posts one receipt; changed payload denied (409), scoped finance denied (403); journals balance and AR equals 759.75");
    for (const mode of ["INCLUDED", "EXCLUDED"]) {
      const response = await request(`/api/v1/pdf/umrah-voucher/${booking.id}?mode=${mode}`, { actor: "staff" });
      assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "private, no-store");
      const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
      fs.writeFileSync(path.join(outputDir, `voucher-${mode}.pdf`), bytes);
    }
    assert.equal((await request(`/api/v1/pdf/umrah-voucher/${booking.id}`, { actor: "outsider" })).status, 404);
    checks.push("voucher HTTP downloads in both price modes; foreign branch denied (404)");
    for (const [actor, email] of [["customer", lead.email], ["other-customer", `${tag}-other@example.test`]]) {
      await json("/api/account/register", { actor, method: "POST", body: { email, password, confirmPassword: password, displayName: "Synthetic HTTP account" } }, 201);
      await json("/api/account/login", { actor, method: "POST", body: { email, password } });
    }
    const website = await db.websiteCustomer.findUniqueOrThrow({ where: { email: lead.email } });
    assert.equal((await request("/api/account/bookings", { actor: "customer" })).status, 403);
    await json("/api/v1/website/customer-links", { actor: "staff", method: "POST", body: { websiteCustomerId: website.id, crmCustomerId: quote.customerId, ownershipVerified: true } }, 201);
    const account = await json(`/api/account/bookings?website_customer_id=forged-other-customer`, { actor: "customer" });
    assert.equal(account.bookings.length, 1); assert.equal(account.bookings[0].reference, booking.bookingNumber); assert.equal(account.bookings[0].travelDate, null);
    assert.deepEqual(Object.keys(account.bookings[0]).sort(), ["reference", "service", "destination", "travelDate", "status", "createdAt", "updatedAt"].sort());
    assert.equal((await request("/api/account/bookings", { actor: "other-customer" })).status, 403);
    assert.equal((await request("/api/account/bookings")).status, 401);
    assert.equal((await request(`/v1/customer/bookings?website_customer_id=${quote.customerId}`)).status, 401);
    assert.equal((await request(`/api/v1/pdf/umrah-voucher/${booking.id}`, { actor: "customer" })).status, 401);
    checks.push("real customer login cookies; unverified account denied (403); verified owner sees undated booking with null date; forged selector ignored; other/anonymous accounts and customer document access denied");
    if (process.env.ZAT_PLAYWRIGHT_MODULE) {
      const otherEmail = `${tag}-other@example.test`;
      const otherWebsite = await db.websiteCustomer.findUniqueOrThrow({ where: { email: otherEmail } });
      const otherCrm = await db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Other synthetic browser customer", email: otherEmail, branchId: branch.id } });
      const otherBooking = await db.umrahBooking.create({ data: { bookingNumber: randomUUID(), customerId: otherCrm.id, branchId: branch.id, departureDate: new Date("2031-02-10"), status: "CONFIRMED" } });
      await json("/api/v1/website/customer-links", { actor: "staff", method: "POST", body: { websiteCustomerId: otherWebsite.id, crmCustomerId: otherCrm.id, ownershipVerified: true } }, 201);
      const browserResult = await require("./receipt-browser-checks.cjs")({ origin, outputDir, db, admin, outsider, password, lead, booking, receipt, otherEmail, otherBooking });
      checks.push(...browserResult.checks);
    }
    const unknownRecovery = await json("/api/account/forgot-password", {
      method: "POST",
      body: { email: `${tag}-unknown@example.test` },
    });
    assert.equal(unknownRecovery.message, "If an account matches that email, a recovery link will be sent.");
    assert.equal(smtp.messages.length, 0);
    const recoveryRequest = await json("/api/account/forgot-password", {
      method: "POST",
      body: { email: lead.email.toUpperCase() },
    });
    assert.equal(recoveryRequest.message, "If an account matches that email, a recovery link will be sent.");
    assert.equal(smtp.messages.length, 1);
    const deliveredMessage = smtp.messages[0].replace(/=\r?\n/g, "");
    const recoveryToken = deliveredMessage.match(/token(?:=3D|=)([a-f0-9]{64})/)?.[1];
    assert.ok(recoveryToken);
    const recoveryTokenHash = createHash("sha256").update(recoveryToken).digest("hex");
    const storedResetToken = await db.websiteCustomerPasswordResetToken.findFirstOrThrow({ where: { tokenHash: recoveryTokenHash } });
    assert.notEqual(storedResetToken.tokenHash, recoveryToken);
    assert.ok(storedResetToken.expiresAt > new Date());
    const expiredToken = randomBytes(32).toString("hex");
    await db.websiteCustomerPasswordResetToken.create({
      data: {
        customerId: website.id,
        tokenHash: createHash("sha256").update(expiredToken).digest("hex"),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const newCustomerPassword = `Synthetic-reset-${randomBytes(12).toString("hex")}!`;
    const reset = token => request("/api/account/reset-password", {
      actor: "customer",
      method: "POST",
      body: { token, password: newCustomerPassword },
    });
    assert.equal((await reset(expiredToken)).status, 400);
    assert.equal((await request("/api/account/bookings", { actor: "customer" })).status, 200);
    const attempts = await Promise.all([reset(recoveryToken), reset(recoveryToken)]);
    assert.deepEqual(attempts.map(response => response.status).sort(), [200, 400]);
    const resetResponse = attempts.find(response => response.status === 200);
    assert.deepEqual(await resetResponse.json(), { ok: true, message: "Your password was reset. Existing sessions have been revoked; please sign in again." });
    assert.ok((await db.websiteCustomerPasswordResetToken.findUniqueOrThrow({ where: { id: storedResetToken.id } })).usedAt);
    assert.equal(await db.websiteCustomerSession.count({ where: { customerId: website.id, revokedAt: null } }), 0);
    assert.equal((await request("/api/account/bookings", { actor: "customer" })).status, 401);
    assert.equal((await request("/api/account/reset-password", { method: "POST", body: { token: recoveryToken, password } })).status, 400);
    assert.equal((await request("/api/account/login", { actor: "old-customer-password", method: "POST", body: { email: lead.email, password } })).status, 401);
    await json("/api/account/login", { actor: "new-customer-password", method: "POST", body: { email: lead.email, password: newCustomerPassword } });
    await json("/api/account/login", { actor: "other-customer-password", method: "POST", body: { email: `${tag}-other@example.test`, password } });
    checks.push("customer recovery over real HTTP: unknown and known emails share a generic response; local SMTP capture receives one link; only its hashed token is stored; reset changes the password, rejects reuse, revokes old sessions, and leaves other accounts unaffected");
    const result = { status: "passed", checks, net: "1010.00", paid: "250.25", balance: "759.75", syntheticOnly: true, browserReload: process.env.ZAT_PLAYWRIGHT_MODULE ? "actual Chromium tabs, reload, browser closure and reopen; see browser-result.json for final browser totals" : "simulated new component using persisted storage; real HTTP requests and cookies", localReverseProxy: true, productionAccess: false };
    async function toggleCms(cmsOutage) { await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error("CMS fixture control timed out")), 5000); child.once("message", message => { clearTimeout(timer); assert.equal(message.cmsOutage, cmsOutage); resolve(); }); child.send({ cmsOutage }); }); }
    await toggleCms(true);
    try { await samplePage("isolated CMS HTTP 503 fallback"); } finally { await toggleCms(false); }
    await samplePage("CMS restored");
    checks.push("initial/warm rendering and controlled CMS 503 fallback/restoration return 200; no production performance objective claimed");
    fs.writeFileSync(path.join(outputDir, "rendering-baseline.json"), JSON.stringify({ environment: "local synthetic production build", rendering }, null, 2));
    fs.writeFileSync(path.join(outputDir, "result.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (child && child.exitCode === null) {
      child.send("stop");
      await Promise.race([new Promise(resolve => child.once("exit", resolve)), new Promise(resolve => setTimeout(() => { child.kill(); resolve(); }, 5000).unref())]);
    }
    fs.closeSync(log); await db.$disconnect(); await smtp.close();
  }
}

(process.argv.includes("--serve") ? serve() : journey()).catch(error => { console.error("Synthetic HTTP journey failed:", error.code || error.name, String(error.message).replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[redacted]").slice(0, 300)); process.exitCode = 1; });
