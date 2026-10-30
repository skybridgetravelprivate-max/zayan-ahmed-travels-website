"use strict";
// Real Chrome + packaged gateway. Explicitly disposable synthetic PG17 only.
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const { spawn } = require("node:child_process");
const { randomUUID, randomBytes, createHash } = require("node:crypto");
const { PrismaClient } = require("../node_modules/@prisma/client");
const bcrypt = require("../node_modules/bcryptjs");

async function main() {
  const databaseUrl = process.env.ZAT_SYNTHETIC_DATABASE_URL;
  const target = new URL(databaseUrl);
  assert.equal(target.hostname, "127.0.0.1");
  assert.match(target.pathname, /^\/zat_synthetic_recovery_ops_[a-z0-9_]+$/);
  const root = path.resolve(__dirname, "../.."), output = path.resolve(process.env.ZAT_SYNTHETIC_BROWSER_OUTPUT);
  fs.mkdirSync(output, { recursive: true });
  const db = new PrismaClient({ datasourceUrl: databaseUrl });
  let browser, child, log;
  const checks = [];
  try {
    const [server] = await db.$queryRaw`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(server.version >= 170000 && server.version < 180000);
    for (const file of [".env", "backend/.env", ".next/standalone/.env"]) assert.ok(!fs.existsSync(path.join(root, file)), "Real environment files must not be loaded");
    const tag = randomUUID(); let password = `Synthetic-${randomBytes(12).toString("hex")}!`;
    const hash = await bcrypt.hash(password, 10), role = await db.role.upsert({ where: { name: "SUPER_ADMIN" }, update: {}, create: { name: "SUPER_ADMIN" } });
    const branch = await db.branch.create({ data: { code: tag, name: "Synthetic hotel office" } });
    const admin = await db.user.create({ data: { email: `${tag}@example.test`, username: tag, fullName: "Synthetic hotel operator", passwordHash: hash, defaultBranchId: branch.id, roles: { create: { roleId: role.id } } } });
    const customer = await db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Synthetic hotel customer", branchId: branch.id } });
    const passenger = await db.passenger.create({ data: { fullName: "Synthetic allocated guest", customerId: customer.id } });
    const hotel = await db.hotel.create({ data: { hotelNumber: randomUUID(), name: "Synthetic acceptance hotel", city: "Makkah", country: "Saudi Arabia" } });
    const roomType = await db.hotelRoomType.create({ data: { hotelId: hotel.id, name: "Synthetic single room", occupancy: 1 } });
    for (const [code, type] of [["1100", "ASSET"], ["1300", "ASSET"], ["2100", "LIABILITY"], ["4300", "REVENUE"], ["5100", "EXPENSE"]]) await db.chartOfAccount.upsert({ where: { code }, update: {}, create: { code, name: `Synthetic ${code}`, type } });
    const listener = http.createServer();
    await new Promise(resolve => listener.listen(0, "127.0.0.1", resolve));
    const port = listener.address().port;
    await new Promise(resolve => listener.close(resolve));
    const origin = `http://127.0.0.1:${port}`, env = {};
    for (const key of ["SystemRoot", "WINDIR", "TEMP", "TMP", "PATH", "USERPROFILE", "LOCALAPPDATA", "APPDATA"]) if (process.env[key]) env[key] = process.env[key];
    Object.assign(env, { NODE_ENV: "production", START_MODE: "all", PORT: String(port), GATEWAY_HOST: "127.0.0.1", DATABASE_URL: databaseUrl, JWT_SECRET: randomBytes(40).toString("hex"), JWT_REFRESH_SECRET: randomBytes(40).toString("hex"), CUSTOMER_BOOKINGS_INTERNAL_TOKEN: randomBytes(40).toString("hex"), APP_URL: origin, API_URL: origin, CRM_API_URL: origin, SITE_URL: origin, COOKIE_SECURE: "false", DOCUMENT_UPLOADS_ENABLED: "false", NEXT_TELEMETRY_DISABLED: "1" });
    log = fs.openSync(path.join(output, "packaged-gateway.log"), "w");
    child = spawn(process.execPath, [path.join(root, ".next/standalone/server.js")], { cwd: root, env, stdio: ["ignore", log, log], windowsHide: true });
    const deadline = Date.now() + 60000;
    while (true) {
      try { if ((await fetch(origin + "/api/health")).status === 200) break; } catch { /* Startup is bounded. */ }
      assert.ok(Date.now() < deadline && child.exitCode === null, "Packaged synthetic gateway failed readiness");
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    const { chromium } = require(process.env.ZAT_PLAYWRIGHT_MODULE);
    browser = await chromium.launch({ executablePath: process.env.ZAT_BROWSER_EXECUTABLE || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
    async function login(identity) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const page = await context.newPage();
      await page.goto(origin + "/admin/login");
      await page.getByLabel("Email or username").fill(identity.username);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Staff sign in", exact: true }).click();
      await page.waitForURL(origin + "/admin");
      await page.getByRole("heading", { name: "Due work and open sales", exact: true }).waitFor();
      return { context, page };
    }
    const staff = await login(admin), recovery = await browser.newContext(), reset = await recovery.newPage();
    await reset.goto(origin + "/admin/forgot-password");
    await reset.getByLabel("Staff email", { exact: true }).fill(admin.email);
    await reset.getByRole("button", { name: "Request recovery link", exact: true }).click();
    await reset.getByRole("status").filter({ hasText: "Staff recovery email is unavailable" }).waitFor();
    assert.equal(await db.passwordResetToken.count({ where: { email: admin.email } }), 0);
    checks.push("Actual forgot form reports globally unconfigured mail without creating or disclosing a token; no email sent");
    await reset.goto(origin + "/reset-password?token=invalid");
    await reset.getByText("Open the full recovery link", { exact: false }).waitFor();
    const token = randomBytes(32).toString("hex");
    await db.passwordResetToken.create({ data: { email: admin.email, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 120000) } });
    const navigation = await reset.goto(origin + "/reset-password?token=" + token);
    assert.ok(navigation.headers()["cache-control"].includes("no-store")); assert.equal(navigation.headers()["referrer-policy"], "no-referrer");
    assert.equal(await reset.locator('meta[name="robots"]').getAttribute("content"), "noindex, nofollow");
    const next = `Changed-${randomBytes(12).toString("hex")}!`;
    await reset.getByLabel("New staff password", { exact: true }).fill(next);
    await reset.getByLabel("Confirm new password", { exact: true }).fill(next + "different");
    await reset.getByRole("button", { name: "Reset staff password", exact: true }).click();
    await reset.getByRole("status").filter({ hasText: "passwords do not match" }).waitFor();
    await reset.getByLabel("Confirm new password", { exact: true }).fill(next);
    await reset.getByRole("button", { name: "Reset staff password", exact: true }).click();
    await reset.getByRole("status").filter({ hasText: "Previous staff sessions have been revoked" }).waitFor();
    assert.ok(!reset.url().includes("token="));
    assert.equal((await staff.context.request.get(origin + "/api/auth/me")).status(), 401);
    assert.equal((await recovery.request.post(origin + "/api/auth/reset-password", { headers: { Origin: origin }, data: { token, password: next } })).status(), 400);
    await reset.screenshot({ path: path.join(output, "staff-reset-complete.png"), fullPage: true });
    password = next;
    const operator = await login(admin), page = operator.page;
    checks.push("Actual Chrome reset form rejects mismatch, resets seeded synthetic token once, strips successful token URL and revokes previous real-cookie session; fresh login succeeds");

    await page.goto(origin + "/admin/manage/hotel-bookings");
    await page.getByRole("button", { name: "New hotel reservation", exact: true }).click();
    await page.getByRole("heading", { name: "New hotel reservation", exact: true }).waitFor();
    async function select(name, value) { await page.locator(`select[name="${name}"] option[value="${value}"]`).waitFor({state:"attached"}); await page.locator(`select[name="${name}"]`).selectOption(value); }
    await select("branchId", branch.id); await select("customerId", customer.id); await select("passengerId", passenger.id); await select("hotelId", hotel.id); await select("roomTypeId", roomType.id);
    await page.locator('[name="checkIn"]').fill("2035-04-01T12:00"); await page.locator('[name="checkOut"]').fill("2035-04-03T12:00");
    for (const [name,value] of Object.entries({roomCount:"1",occupancy:"1",sellingPrice:"1000.50",supplierCost:"600.25",paid:"250.25"})) await page.locator(`[name="${name}"]`).fill(value);
    await select("paymentMethod", "CASH");
    await page.locator('input[name="confirm"]').check();
    await page.getByRole("button", { name: "Confirm new hotel reservation", exact: true }).click();
    await page.getByText("Operation completed. Review the refreshed record.", { exact: true }).waitFor();
    const booking = await db.hotelBooking.findFirstOrThrow({ where: { customerId: customer.id }, include: { staySegments: { include: { rooms: { include: { pax: true } } } } } });
    assert.equal(booking.net.toFixed(2), "1000.50"); assert.equal(booking.paid.toFixed(2), "250.25"); assert.equal(booking.balance.toFixed(2), "750.25");
    const room = booking.staySegments[0].rooms[0]; assert.equal(room.pax[0].passengerId, passenger.id);
    await page.goto(origin + `/admin/manage/hotel-bookings?record=${booking.id}`);
    const early = await operator.context.request.post(origin + `/api/v1/hotel-reservations/${booking.id}/checkout`, { data: {roomId:room.id}, headers:{Origin:origin} }); assert.equal(early.status(),400);
    for (const [action,label] of [["checkin","Check in room"],["checkout","Check out room"]]) {
      await page.getByRole("button",{name:label,exact:true}).click(); await select("roomId",room.id);
      if(action==="checkin") await page.locator('[name="roomNumber"]').fill("101");
      await page.locator('input[name="confirm"]').check(); await page.getByRole("button",{name:`Confirm ${label.toLowerCase()}`,exact:true}).click();
      await page.getByRole("heading",{name:label,exact:true}).waitFor({state:"hidden"});
      assert.equal((await db.hotelStayRoom.findUniqueOrThrow({where:{id:room.id}})).status,action==="checkin"?"CHECKED_IN":"CHECKED_OUT");
    }
    const receipt = await db.receipt.findFirstOrThrow({where:{hotelBookingId:booking.id}});assert.equal(receipt.amount.toFixed(2),"250.25");assert.equal(await db.receipt.count({where:{hotelBookingId:booking.id}}),1);
    const [balance] = await db.$queryRaw`SELECT coalesce(sum(l.debit-l.credit),0)::text AS balance FROM "JournalLine" l JOIN "JournalEntry" j ON j.id=l."journalId" JOIN "ChartOfAccount" a ON a.id=l."accountId" WHERE l."partyId"=${customer.id} AND a.code='1300' AND j.status='POSTED'`;
    assert.equal(Number(balance.balance).toFixed(2),"750.25");
    const unbalanced = await db.$queryRaw`SELECT j.id FROM "JournalEntry" j JOIN "JournalLine" l ON l."journalId"=j.id WHERE j.status='POSTED' GROUP BY j.id HAVING sum(l.debit-l.credit)<>0`; assert.equal(unbalanced.length,0);
    const report = await operator.context.request.get(origin + "/api/v1/reports/run/receivables");assert.equal(report.status(),200);const reportRow = (await report.json()).rows.find(r => r.clientId === customer.id); assert.ok(reportRow); assert.equal(Number(reportRow.debit).toFixed(2),"750.25");
    const pdf = await operator.context.request.get(origin + `/api/v1/pdf/receipt/${receipt.id}`);assert.equal(pdf.status(),200);assert.ok(pdf.headers()["cache-control"].includes("no-store"));assert.equal((await pdf.body()).subarray(0,5).toString(),"%PDF-");fs.writeFileSync(path.join(output,"synthetic-hotel-receipt.pdf"),await pdf.body());
    const anonymous = await browser.newContext();assert.equal((await anonymous.request.get(origin+`/api/v1/hotel-reservations/${booking.id}`)).status(),401);
    const foreignBranch=await db.branch.create({data:{code:randomUUID(),name:"Synthetic foreign office"}}),foreignRole=await db.role.create({data:{name:randomUUID()}});
    for(const code of ["hotel.booking","reservation.checkin","reservation.checkout"]){const p=await db.permission.upsert({where:{code},update:{},create:{code}});await db.rolePermission.create({data:{roleId:foreignRole.id,permissionId:p.id}});}
    const foreign=await db.user.create({data:{username:randomUUID(),email:`${randomUUID()}@example.test`,passwordHash:await bcrypt.hash(password,10),fullName:"Synthetic foreign hotel staff",defaultBranchId:foreignBranch.id,roles:{create:{roleId:foreignRole.id}}}});
    const foreignContext=await browser.newContext();const signed=await foreignContext.request.post(origin+"/api/auth/login",{headers:{Origin:origin},data:{identifier:foreign.username,password}});assert.equal(signed.status(),201);assert.equal((await foreignContext.request.get(origin+`/api/v1/hotel-reservations/${booking.id}`)).status(),404);
    for(const width of [375,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(output,`hotel-completed-${width}.png`),fullPage:true});}
    checks.push("Actual hotel quick form creates one guest/one room with keyed CASH receipt; checkout-before-checkin denied; real UI check-in/check-out complete; receipt250.25, balance and posted AR750.25; reports and private PDF agree; anonymous/foreign branch denied");
    const result={status:"passed",syntheticOnly:true,checks,hotel:{net:"1000.50",paid:"250.25",balance:"750.25",roomStatus:"CHECKED_OUT"},limits:["Single-room one-guest quick allocation only","No supplier confirmation or payout claimed","No customer website hotel history or accommodation voucher generation verified","No actual email delivery or production password change"],productionChanges:false};fs.writeFileSync(path.join(output,"recovery-hotel-browser-result.json"),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  } finally {
    if (browser) await browser.close();
    if (child && child.exitCode === null) { child.kill(); await new Promise(resolve=>child.once("exit",resolve)); }
    if(log!==undefined) fs.closeSync(log);await db.$disconnect();
  }
}
main().catch(e=>{console.error(String(e.stack||e).replace(/token=[^\s"']+/g,"token=[redacted]"));process.exitCode=1;});
