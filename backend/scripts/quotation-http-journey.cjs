"use strict";

// Opt-in integration proof. Requires a built temporary project and disposable PG17.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { pathToFileURL } = require("node:url");
const { randomUUID, randomBytes } = require("node:crypto");
const { spawn } = require("node:child_process");
const root = path.resolve(__dirname, "../..");
const databaseUrl = process.env.ZAT_SYNTHETIC_DATABASE_URL;
if (!databaseUrl) throw Error("Set ZAT_SYNTHETIC_DATABASE_URL to a disposable local PG17 database");
const target = new URL(databaseUrl);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(target.hostname));
assert.match(target.pathname, /^\/zat_synthetic_[a-z0-9_]+$/);

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
  const server = http.createServer((request, response) => isApiPathname(request.url.split("?")[0]) ? api(request, response) : handle(request, response));
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
    for (const [code, type] of [["1100", "ASSET"], ["1300", "ASSET"], ["2100", "LIABILITY"], ["4100", "REVENUE"], ["5100", "EXPENSE"]]) await db.chartOfAccount.upsert({ where: { code }, update: {}, create: { code, name: `Synthetic ${code}`, type } });
    const lead = await db.lead.create({ data: { leadNumber: randomUUID(), fullName: "Synthetic HTTP traveler", mobile: "+923000000000", email: `${tag}-customer@example.test`, adults: 3, budget: 1000.03, branchId: branch.id } });
    const environment = {};
    for (const key of ["SystemRoot", "WINDIR", "TEMP", "TMP", "PATH", "USERPROFILE", "LOCALAPPDATA"]) if (process.env[key]) environment[key] = process.env[key];
    Object.assign(environment, { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", DATABASE_URL: databaseUrl, ZAT_SYNTHETIC_DATABASE_URL: databaseUrl, ZAT_SYNTHETIC_HTTP_PORT: String(port), JWT_SECRET: randomBytes(32).toString("hex"), JWT_REFRESH_SECRET: randomBytes(32).toString("hex"), CUSTOMER_BOOKINGS_INTERNAL_TOKEN: randomBytes(32).toString("hex"), APP_URL: origin, API_URL: origin, CRM_API_URL: origin, COOKIE_SECURE: "false" });
    child = spawn(process.execPath, [__filename, "--serve"], { cwd: root, env: environment, stdio: ["ignore", log, log, "ipc"], windowsHide: true });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("Synthetic gateway startup timed out")), 45000);
      child.once("message", message => { clearTimeout(timer); assert.equal(message.ready, true); resolve(); });
      child.once("exit", () => { clearTimeout(timer); reject(Error("Synthetic gateway failed to start; inspect local server.log")); });
    });
    await json("/api/auth/login", { actor: "staff", method: "POST", body: { identifier: admin.username, password } }, 201);
    await json("/api/auth/login", { actor: "outsider", method: "POST", body: { identifier: outsider.username, password } }, 201);
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
    const result = { status: "passed", checks, net: "1010.00", paid: "250.25", balance: "759.75", syntheticOnly: true, browserReload: process.env.ZAT_PLAYWRIGHT_MODULE ? "actual Chromium tabs, reload, browser closure and reopen; see browser-result.json for final browser totals" : "simulated new component using persisted storage; real HTTP requests and cookies", localReverseProxy: true, productionAccess: false };
    fs.writeFileSync(path.join(outputDir, "result.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (child && child.exitCode === null) {
      child.send("stop");
      await Promise.race([new Promise(resolve => child.once("exit", resolve)), new Promise(resolve => setTimeout(() => { child.kill(); resolve(); }, 5000).unref())]);
    }
    fs.closeSync(log); await db.$disconnect();
  }
}

(process.argv.includes("--serve") ? serve() : journey()).catch(error => { console.error("Synthetic HTTP journey failed:", error.code || error.name, String(error.message).replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[redacted]").slice(0, 300)); process.exitCode = 1; });
