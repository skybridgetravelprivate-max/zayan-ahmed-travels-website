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
  assert.match(target.pathname, /^\/zat_synthetic_hotel_[a-z0-9_]+$/);
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
    const operator = await login(admin), page = operator.page;
    await page.goto(origin + "/admin/manage/hotel-bookings");
    await page.getByRole("button", { name: "New hotel reservation", exact: true }).click();
    await page.getByRole("heading", { name: "New hotel reservation", exact: true }).waitFor();
    async function select(name, value) { await page.locator(`select[name="${name}"] option[value="${value}"]`).waitFor({state:"attached"}); await page.locator(`select[name="${name}"]`).selectOption(value); }
    await select("branchId", branch.id); await select("customerId", customer.id); await select("hotelId", hotel.id); await select("roomTypeId", roomType.id);
    await page.locator('[name="checkIn"]').fill("2035-04-01T12:00"); await page.locator('[name="checkOut"]').fill("2035-04-03T12:00");
    for (const [name,value] of Object.entries({roomCount:"2",occupancy:"2",sellingPrice:"1000.50",supplierCost:"600.25",paid:"250.25"})) await page.locator(`[name="${name}"]`).fill(value);
    await select("paymentMethod", "CASH");
    await page.locator('input[name="confirm"]').check();
    await page.getByRole("button", { name: "Confirm new hotel reservation", exact: true }).click();
    await page.getByText("Operation completed. Review the refreshed record.", { exact: true }).waitFor();
    const booking = await db.hotelBooking.findFirstOrThrow({ where: { customerId: customer.id }, include: { staySegments: { include: { rooms: { include: { pax: true } } } } } });
    assert.equal(booking.net.toFixed(2), "2001.00"); assert.equal(booking.paid.toFixed(2), "250.25"); assert.equal(booking.balance.toFixed(2), "1750.75");
    let room = booking.staySegments[0].rooms[0];
    const secondGuest=await db.passenger.create({data:{fullName:"Synthetic second guest",customerId:customer.id}});
    const thirdGuest=await db.passenger.create({data:{fullName:"Synthetic third guest",customerId:customer.id}});
    await page.goto(origin + `/admin/manage/hotel-bookings?record=${booking.id}`);
    for(const [roomId,guest] of [[room.id,passenger],[room.id,secondGuest],[booking.staySegments[0].rooms[1].id,thirdGuest]]) {
      await page.getByRole("button",{name:"Assign room guest",exact:true}).click();
      await select("roomId",roomId);await select("passengerId",guest.id);
      await page.locator('input[name="confirm"]').check();await page.getByRole("button",{name:"Confirm assign room guest",exact:true}).click();
      await page.getByRole("heading",{name:"Assign room guest",exact:true}).waitFor({state:"hidden"});
    }
    assert.equal(await db.hotelStayRoomPax.count({where:{stayRoomId:room.id}}),2);
    await page.getByRole("button",{name:"Transfer room guests",exact:true}).click();await select("fromRoomId",room.id);
    await page.locator('[name="roomNumber"]').fill("201");await page.locator('input[name="confirm"]').check();
    await page.getByRole("button",{name:"Confirm transfer room guests",exact:true}).click();
    await page.getByRole("heading",{name:"Transfer room guests",exact:true}).waitFor({state:"hidden"});
    const moved=await db.hotelStayTransfer.findFirstOrThrow({where:{fromRoomId:room.id}});
    const oldId=room.id;room=await db.hotelStayRoom.findUniqueOrThrow({where:{id:moved.toRoomId}});
    assert.equal(await db.hotelStayRoomPax.count({where:{stayRoomId:room.id}}),2);
    const repeat=await operator.context.request.post(origin+`/api/v1/hotel-reservations/${booking.id}/transfer`,{headers:{Origin:origin},data:{fromRoomId:oldId,roomNumber:"202"}});assert.equal(repeat.status(),400);
    const mismatch=await operator.context.request.post(origin+`/api/v1/hotel-reservations/not-this-booking/checkin`,{headers:{Origin:origin},data:{roomId:room.id}});assert.equal(mismatch.status(),400);
    const early = await operator.context.request.post(origin + `/api/v1/hotel-reservations/${booking.id}/checkout`, { data: {roomId:room.id}, headers:{Origin:origin} }); assert.equal(early.status(),400);
    for (const [action,label] of [["checkin","Check in room"],["checkout","Check out room"]]) {
      await page.getByRole("button",{name:label,exact:true}).click(); await select("roomId",room.id);
      if(action==="checkin") await page.locator('[name="roomNumber"]').fill("201");
      await page.locator('input[name="confirm"]').check(); await page.getByRole("button",{name:`Confirm ${label.toLowerCase()}`,exact:true}).click();
      await page.getByRole("heading",{name:label,exact:true}).waitFor({state:"hidden"});
      assert.equal((await db.hotelStayRoom.findUniqueOrThrow({where:{id:room.id}})).status,action==="checkin"?"CHECKED_IN":"CHECKED_OUT");
    }
    for(const action of ["checkin","checkout"]){const response=await operator.context.request.post(origin+`/api/v1/hotel-reservations/${booking.id}/${action}`,{headers:{Origin:origin},data:{roomId:booking.staySegments[0].rooms[1].id}});assert.equal(response.status(),201);}
    const accommodation=await operator.context.request.get(origin+`/api/v1/pdf/hotel-reservation/${booking.id}`);assert.equal(accommodation.status(),200);assert.ok(accommodation.headers()["cache-control"].includes("no-store"));assert.equal((await accommodation.body()).subarray(0,5).toString(),"%PDF-");
    fs.writeFileSync(path.join(output,"hotel-reservation.pdf"),await accommodation.body());
    const excluded=await operator.context.request.get(origin+`/api/v1/pdf/hotel-reservation/${booking.id}?mode=EXCLUDED`);assert.equal(excluded.status(),200);fs.writeFileSync(path.join(output,"hotel-reservation-excluded.pdf"),await excluded.body());
    const customerView=await operator.context.request.get(origin+`/v1/customer/bookings?website_customer_id=${customer.id}`,{headers:{"x-zat-internal-token":env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN}});assert.equal(customerView.status(),200);assert.equal((await customerView.json()).bookings.find(row=>row.reference===booking.bookingNumber).status,"Completed");
    const otherCustomer=await db.customer.create({data:{customerNumber:randomUUID(),fullName:"Synthetic isolated customer",branchId:branch.id}});
    const isolatedView=await operator.context.request.get(origin+`/v1/customer/bookings?website_customer_id=${otherCustomer.id}`,{headers:{"x-zat-internal-token":env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN}});assert.equal(isolatedView.status(),200);assert.equal((await isolatedView.json()).bookings.length,0);
    const receipt = await db.receipt.findFirstOrThrow({where:{hotelBookingId:booking.id}});assert.equal(receipt.amount.toFixed(2),"250.25");assert.equal(await db.receipt.count({where:{hotelBookingId:booking.id}}),1);
    const [balance] = await db.$queryRaw`SELECT coalesce(sum(l.debit-l.credit),0)::text AS balance FROM "JournalLine" l JOIN "JournalEntry" j ON j.id=l."journalId" JOIN "ChartOfAccount" a ON a.id=l."accountId" WHERE l."partyId"=${customer.id} AND a.code='1300' AND j.status='POSTED'`;
    assert.equal(Number(balance.balance).toFixed(2),"1750.75");
    const unbalanced = await db.$queryRaw`SELECT j.id FROM "JournalEntry" j JOIN "JournalLine" l ON l."journalId"=j.id WHERE j.status='POSTED' GROUP BY j.id HAVING sum(l.debit-l.credit)<>0`; assert.equal(unbalanced.length,0);
    const report = await operator.context.request.get(origin + "/api/v1/reports/run/receivables");assert.equal(report.status(),200);const reportRow = (await report.json()).rows.find(r => r.clientId === customer.id); assert.ok(reportRow); assert.equal(Number(reportRow.debit).toFixed(2),"1750.75");
    const pdf = await operator.context.request.get(origin + `/api/v1/pdf/receipt/${receipt.id}`);assert.equal(pdf.status(),200);assert.ok(pdf.headers()["cache-control"].includes("no-store"));assert.equal((await pdf.body()).subarray(0,5).toString(),"%PDF-");fs.writeFileSync(path.join(output,"synthetic-hotel-receipt.pdf"),await pdf.body());
    const anonymous = await browser.newContext();assert.equal((await anonymous.request.get(origin+`/api/v1/hotel-reservations/${booking.id}`)).status(),401);
    const foreignBranch=await db.branch.create({data:{code:randomUUID(),name:"Synthetic foreign office"}}),foreignRole=await db.role.create({data:{name:randomUUID()}});
    for(const code of ["hotel.booking","reservation.checkin","reservation.checkout"]){const p=await db.permission.upsert({where:{code},update:{},create:{code}});await db.rolePermission.create({data:{roleId:foreignRole.id,permissionId:p.id}});}
    const foreign=await db.user.create({data:{username:randomUUID(),email:`${randomUUID()}@example.test`,passwordHash:await bcrypt.hash(password,10),fullName:"Synthetic foreign hotel staff",defaultBranchId:foreignBranch.id,roles:{create:{roleId:foreignRole.id}}}});
    const foreignContext=await browser.newContext();const signed=await foreignContext.request.post(origin+"/api/auth/login",{headers:{Origin:origin},data:{identifier:foreign.username,password}});assert.equal(signed.status(),201);assert.equal((await foreignContext.request.get(origin+`/api/v1/hotel-reservations/${booking.id}`)).status(),404);
    for(const width of [375,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.ok(await page.locator('nav[aria-label="Staff workspace"]').evaluate(el=>el.getBoundingClientRect().right<=innerWidth+1));assert.ok(await page.getByRole("heading",{name:"Hotel reservations",exact:true}).evaluate(el=>el.getBoundingClientRect().right<=innerWidth+1));await page.screenshot({path:path.join(output,`hotel-completed-${width}.png`),fullPage:true});}
    checks.push("Chrome: two-room creation, three guest allocations, two-guest transfer, check-in/out, moved-source retry and wrong booking denial; HTTP second room checkout and customer completed/isolation projection; one receipt250.25, booking balance and posted AR1750.75, balanced journals and receivables report; private receipt and reservation PDFs in both price modes; anonymous/foreign branch denial; mobile375 and desktop1440 no overflow");
    const longGuests=await Promise.all(Array.from({length:16},(_,i)=>db.passenger.create({data:{fullName:`Synthetic long guest ${i} `+"Extended family name ".repeat(7),customerId:customer.id}})));
    const large=await operator.context.request.post(origin+"/api/v1/hotel-reservations",{headers:{Origin:origin},data:{branchId:branch.id,customerId:customer.id,segments:[{hotelId:hotel.id,checkIn:"2041-01-01",checkOut:"2041-01-03",rooms:Array.from({length:8},(_,i)=>({occupancy:2,passengerIds:longGuests.slice(i*2,i*2+2).map(p=>p.id)}))}]}});assert.equal(large.status(),201);const largeBooking=await large.json();
    for(const mode of ["INCLUDED","EXCLUDED"]){const document=await operator.context.request.get(origin+`/api/v1/pdf/hotel-reservation/${largeBooking.id}?mode=${mode}`);assert.equal(document.status(),200);fs.writeFileSync(path.join(output,`hotel-multipage-${mode}.pdf`),await document.body());}
    checks.push("Eight-room, sixteen-long-name reservation PDFs generated in both price modes for separate pagination inspection");
    const result={status:"passed",syntheticOnly:true,checks,hotel:{net:"2001.00",paid:"250.25",balance:"1750.75",roomStatus:"CHECKED_OUT"},limits:["No supplier confirmation or payout claimed","Customer projection tested through internal HTTP; public account login not repeated","Full settlement and supplier settlement not tested","No actual email delivery or production password change"],productionChanges:false};fs.writeFileSync(path.join(output,"hotel-operations-browser-result.json"),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  } finally {
    if (browser) await browser.close();
    if (child && child.exitCode === null) { child.kill(); await new Promise(resolve=>child.once("exit",resolve)); }
    if(log!==undefined) fs.closeSync(log);await db.$disconnect();
  }
}
main().catch(e=>{console.error(String(e.stack||e).replace(/token=[^\s"']+/g,"token=[redacted]"));process.exitCode=1;});
