import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { BadGatewayException, Logger } from "@nestjs/common";
// Nest's constructor metadata is emitted by tsc, not by the tsx test loader.
import { createNestApp } from "../../dist/create-app";
import { WhatsAppService } from "../../dist/common/whatsapp.service";
import { ReportsService } from "../reports/reports.service";
import { hashPassword } from "../common/password";

test("PG17 HTTP hardening: payroll, exact invoices and FX containment", { skip: !process.env.ZAT_SYNTHETIC_DATABASE_URL }, async t => {
  const target = new URL(process.env.ZAT_SYNTHETIC_DATABASE_URL!);
  assert.equal(target.hostname, "127.0.0.1"); assert.equal(target.port, "55463"); assert.ok(target.pathname === "/zat_synthetic_manual_workflows" || /^\/zat_synthetic_hardening_[a-z0-9_]+$/.test(target.pathname));
  assert.equal(process.env.DATABASE_URL, target.toString());
  const db = new PrismaClient({ datasourceUrl: target.toString() });
  const secret = randomBytes(32).toString("hex");
  const oldSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = secret;
  Logger.overrideLogger(false);
  const app = await createNestApp();
  try {
    await app.listen(0, "127.0.0.1"); const origin = await app.getUrl();
    const [version] = await db.$queryRaw<{ version: number }[]>`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(version.version >= 170000 && version.version < 180000);
    const branch = await db.branch.create({ data: { code: randomUUID(), name: "Synthetic hardening branch" } });
    const superRole = await db.role.upsert({ where: { name: "SUPER_ADMIN" }, update: {}, create: { name: "SUPER_ADMIN" } });
    const hr = await db.permission.upsert({ where: { code: "hr.create" }, update: {}, create: { code: "hr.create" } });
    const scopedRole = await db.role.create({ data: { name: randomUUID(), permissions: { create: { permissionId: hr.id } } } });
    const password = "Synthetic-Staff-Password-2026!", passwordHash = await hashPassword(password);
    async function token(roleId: string) {
      const user = await db.user.create({ data: { username: randomUUID(), email: `${randomUUID()}@example.test`, fullName: "Synthetic operator", passwordHash, defaultBranchId: branch.id, roles: { create: { roleId } }, branches: { create: { branchId: branch.id } } } });
      const response = await fetch(origin + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: user.username, password, portal: roleId === superRole.id ? "super-admin" : "staff" }) });
      assert.equal(response.status, 201);
      const access = response.headers.getSetCookie().find(cookie => cookie.startsWith("access_token="))?.split(";")[0].slice("access_token=".length);
      assert.ok(access); return decodeURIComponent(access);
    }
    const admin = await token(superRole.id), staff = await token(scopedRole.id);
    const post = (path: string, body: object, key = randomUUID(), bearer = admin) => fetch(origin + path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}`, "Idempotency-Key": key }, body: JSON.stringify(body) });
    const counts = async () => ({ runs: await db.payrollRun.count(), slips: await db.salarySlip.count(), tickets: await db.ticketSale.count(), journals: await db.journalEntry.count(), receipts: await db.receipt.count() });
    await t.test("scoped HR role cannot create payroll or disclose salaries", async () => {
      const before = await counts(); const response = await post("/api/v1/workflows/payroll/run", { period: "2099-01" }, randomUUID(), staff);
      assert.equal(response.status, 403); assert.doesNotMatch(await response.text(), /basicSalary|slipNo/); assert.deepEqual(await counts(), before);
    });
    const employee = await db.employee.create({ data: { employeeNo: randomUUID(), fullName: "Synthetic payroll employee", basicSalary: "0.30" } });
    await t.test("late slip failure rolls back the run, slips, sequence and audit", async () => {
      // A negative salary is a disposable legacy-data fixture rejected after an earlier valid slip.
      const bad = await db.employee.create({ data: { id: "zz-" + randomUUID(), employeeNo: randomUUID(), fullName: "Synthetic invalid salary", basicSalary: "-1" } });
      const before = await counts(), sequences = await db.numberSequence.findMany({ orderBy: { key: "asc" } }), audit = await db.auditLog.count();
      try { const response = await post("/api/v1/workflows/payroll/run", { period: "2099-02" }); assert.equal(response.status, 400); assert.deepEqual(await counts(), before); assert.deepEqual(await db.numberSequence.findMany({ orderBy: { key: "asc" } }), sequences); assert.equal(await db.auditLog.count(), audit); }
      finally { await db.employee.delete({ where: { id: bad.id } }); }
    });
    await t.test("concurrent retries return one audited payroll; changed payload conflicts", async () => {
      const key = randomUUID(), before = await counts();
      const responses = await Promise.all([post("/api/v1/workflows/payroll/run", { period: "2099-03" }, key), post("/api/v1/workflows/payroll/run", { period: "2099-03" }, key)]);
      for (const r of responses) assert.equal(r.status, 201);
      const [a,b] = await Promise.all(responses.map(r=>r.json())); assert.equal(a.run.id,b.run.id); assert.equal((await counts()).runs,before.runs+1);
      assert.equal(await db.auditLog.count({ where: { entityId: a.run.id, action: "PAYROLL_SUBMITTED" } }),1);
      assert.equal((await db.salarySlip.findFirstOrThrow({ where: { payrollId:a.run.id, employeeId:employee.id } })).net.toFixed(2),"0.30");
      assert.equal((await post("/api/v1/workflows/payroll/run", { period: "2099-04" }, key)).status,409);
    });
    for (const [code,type] of [["1300","ASSET"],["4600","REVENUE"],["5100","EXPENSE"],["2100","LIABILITY"]] as const) await db.chartOfAccount.upsert({ where:{code},update:{},create:{code,name:"Synthetic invoice account",type} });
    await t.test("0.10 + 0.20 invoice persists exact lines and balanced journals",async()=>{
      const response=await post("/api/v1/finance/invoices",{lines:[{description:"First",unitPrice:"0.10"},{description:"Second",unitPrice:"0.20"}]}); assert.equal(response.status,201,await response.clone().text()); const invoice=await response.json();
      assert.equal(invoice.net,"0.3"); const saved=await db.serviceInvoice.findUniqueOrThrow({where:{id:invoice.id},include:{lines:true}});assert.equal(saved.net.toFixed(2),"0.30");assert.deepEqual(saved.lines.map(l=>l.amount.toFixed(2)).sort(),["0.10","0.20"]);
      const journal=await db.journalLine.aggregate({where:{journalId:saved.journalId!},_sum:{debit:true,credit:true}});assert.equal(journal._sum.debit?.toFixed(2),"0.30");assert.equal(journal._sum.credit?.toFixed(2),"0.30");
      const count=await db.serviceInvoice.count();for(const qty of [0,-1,1.5])assert.equal((await post("/api/v1/finance/invoices",{lines:[{description:"Invalid",qty,unitPrice:1}]})).status,400);assert.equal(await db.serviceInvoice.count(),count);
    });
    await t.test("foreign currency or non-unit FX is denied without financial writes",async()=>{
      const before=await counts(); for(const fields of [{currency:"USD",exchangeRate:"280"},{currency:"PKR",exchangeRate:"1.5"}]) assert.equal((await post("/api/v1/workflows/tickets",{ticketNumber:randomUUID(),fare:"100.00",branchId:branch.id,...fields})).status,400);assert.deepEqual(await counts(),before);
      const ticket=await db.ticketSale.create({data:{ticketNumber:randomUUID(),fare:100,net:100,paidAmount:100,paymentStatus:"PAID",status:"ISSUED",branchId:branch.id,currency:"USD",exchangeRate:280}});
      const legacy=await counts();assert.equal((await post(`/api/v1/workflows/tickets/${ticket.id}/refund`,{refundAmount:1,reason:"Synthetic"})).status,400);assert.equal((await post(`/api/v1/workflows/tickets/${ticket.id}/reissue`,{agencyFee:1})).status,400);assert.equal((await post("/api/v1/finance/receipts",{ticketSaleId:ticket.id,amount:1,method:"CASH"})).status,400);assert.deepEqual(await counts(),legacy);
    });
    await t.test("database daily aggregation filters dates and preserves exact transport selling totals",async()=>{
      for(const [sellingPrice,cost] of [["0.10","0.03"],["0.20","0.04"]]) await db.transportBooking.create({data:{bookingNumber:randomUUID(),sellingPrice,cost,net:"0.00",tripDate:new Date("2099-12-30T12:00:00Z")}});
      const report=await new ReportsService(db as never,{} as never).run("daily-sale",{from:"2099-12-30",to:"2099-12-30"});assert.equal(report.rows.length,1);assert.equal(report.rows[0].sale,"0.30");assert.equal(report.rows[0].profit,"0.23");assert.equal(report.rows[0].count,2);
    });
    await t.test("WhatsApp duplicate and ambiguous submissions require explicit reconciliation without automatic resend",async()=>{
      const wa=app.get(WhatsAppService),original=wa.send;let calls=0;
      try {
        wa.send=async()=>{calls++;return {id:"synthetic-provider-reference"};};
        const key=randomUUID(),body={to:"+10000000000",message:"Synthetic accepted message"};
        const responses=await Promise.all([post("/api/v1/comms/whatsapp",body,key),post("/api/v1/comms/whatsapp",body,key)]);
        assert.ok(responses.every(r=>[201,409].includes(r.status)));assert.equal(calls,1);
        assert.equal((await post("/api/v1/comms/whatsapp",body,key)).status,201);assert.equal(calls,1);
        assert.equal((await post("/api/v1/comms/whatsapp",{...body,message:"Different"},key)).status,409);
        wa.send=async()=>{calls++;throw new BadGatewayException("Synthetic lost response after provider acceptance");};
        const ambiguous={...body,message:"Synthetic ambiguous message"},uncertainKey=randomUUID();assert.equal((await post("/api/v1/comms/whatsapp",ambiguous,uncertainKey)).status,502);
        assert.equal((await post("/api/v1/comms/whatsapp",ambiguous,uncertainKey)).status,409);assert.equal((await post("/api/v1/comms/whatsapp",ambiguous)).status,409);assert.equal(calls,2);
        const row=await db.outboundMessage.findFirstOrThrow({where:{status:"UNCERTAIN"},orderBy:{createdAt:"desc"}});
        const status = await fetch(origin + "/api/v1/comms/whatsapp/submission/" + uncertainKey, { headers: { Authorization: `Bearer ${admin}` } });
        assert.equal(status.status, 200);assert.equal((await status.json()).status,"UNCERTAIN");
        assert.equal((await post(`/api/v1/comms/whatsapp/${row.id}/reconcile`,{status:"SENT",reason:"Denied scoped review"},randomUUID(),staff)).status,403);
        assert.equal((await post(`/api/v1/comms/whatsapp/${row.id}/reconcile`,{status:"SENT",reason:"Synthetic provider confirmed delivery",providerReference:"synthetic-reconciled"})).status,201);
        assert.equal((await post("/api/v1/comms/whatsapp",ambiguous,uncertainKey)).status,201);assert.equal(calls,2);
        assert.equal(await db.auditLog.count({where:{action:"RECONCILE_WHATSAPP",entityId:row.id}}),1);
        const notSent={...body,message:"Synthetic confirmed not sent"},notSentKey=randomUUID();
        assert.equal((await post("/api/v1/comms/whatsapp",notSent,notSentKey)).status,502);
        const unresolved=await db.outboundMessage.findFirstOrThrow({where:{status:"UNCERTAIN"},orderBy:{createdAt:"desc"}});
        await post(`/api/v1/comms/whatsapp/${unresolved.id}/reconcile`,{status:"NOT_SENT",reason:"Synthetic provider confirmed no acceptance"});
        assert.equal((await post("/api/v1/comms/whatsapp",notSent,notSentKey)).status,409);
        wa.send=async()=>{calls++;return {id:"synthetic-explicit-new-send"};};
        assert.equal((await post("/api/v1/comms/whatsapp",notSent)).status,201);assert.equal(calls,4);
      }finally{wa.send=original;}
    });
    await t.test("representative synthetic query plans use the additive recent-auth and customer-ticket indexes",async()=>{
      const tag="idx_"+randomUUID();
      await db.$executeRaw`INSERT INTO "LoginAttempt" (id,identifier,success,"createdAt") SELECT ${tag}||n::text,'zat-customer:login:synthetic',false,NOW()-n*INTERVAL '1 minute' FROM generate_series(1,20000) AS n`;
      await db.customer.createMany({data:Array.from({length:100},(_,n)=>({id:tag+"c"+n,customerNumber:tag+"c"+n,fullName:"Synthetic index fixture"}))});
      await db.$executeRaw`INSERT INTO "TicketSale" (id,"ticketNumber","customerId","updatedAt") SELECT ${tag}||n::text,${tag}||n::text,${tag}||'c'||(n%100)::text,NOW() FROM generate_series(1,20000) AS n`;
      await db.$executeRaw`ANALYZE "LoginAttempt"`;await db.$executeRaw`ANALYZE "TicketSale"`;
      const auth=await db.$queryRaw<Record<string,unknown>[]>`EXPLAIN (ANALYZE,FORMAT JSON) SELECT count(*) FROM "LoginAttempt" WHERE "createdAt">NOW()-INTERVAL '15 minutes'`;
      const tickets=await db.$queryRaw<Record<string,unknown>[]>`EXPLAIN (ANALYZE,FORMAT JSON) SELECT id FROM "TicketSale" WHERE "customerId"=${tag+"c0"} ORDER BY "createdAt" DESC LIMIT 20`;
      assert.match(JSON.stringify(auth),/LoginAttempt_createdAt_idx/);assert.match(JSON.stringify(tickets),/TicketSale_customerId_createdAt_idx/);
      t.diagnostic("20,000-row isolated plans selected LoginAttempt_createdAt_idx and TicketSale_customerId_createdAt_idx; no planner settings forced");
    });
  } finally { await app.close(); await db.$disconnect(); if(oldSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=oldSecret; }
});
