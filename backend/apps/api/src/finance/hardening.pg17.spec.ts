import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { BadGatewayException, Logger } from "@nestjs/common";
// Nest's constructor metadata is emitted by tsc, not by the tsx test loader.
import { createNestApp } from "../../dist/create-app";
import { WhatsAppService } from "../../dist/common/whatsapp.service";
import { MailService } from "../../dist/common/mail.service";
import net from "node:net";
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
  let app = await createNestApp();
  try {
    await app.listen(0, "127.0.0.1"); let origin = await app.getUrl();
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
    await t.test("concurrent different messages sharing a request key reject the loser without a second provider call", async () => {
      const wa = app.get(WhatsAppService), original = wa.send;
      let calls = 0;
      try {
        wa.send = async () => { calls++; return { id: "synthetic-concurrent-provider" }; };
        const key = randomUUID();
        const results = await Promise.all(["First", "Second"].map(message => post("/api/v1/comms/whatsapp", { to: "+10000000003", message }, key)));
        assert.deepEqual(results.map(response => response.status).sort(), [201, 409]);
        assert.equal(calls, 1);
      } finally { wa.send = original; }
    });
    await t.test("CRM lead, customer and quotation WhatsApp routes share durable uncertain-send protection", async () => {
      const wa = app.get(WhatsAppService), original = wa.send;
      let calls = 0;
      try {
        wa.send = async () => { calls++; throw new BadGatewayException("Synthetic provider accepted, response lost"); };
        const lead = await db.lead.create({ data: { leadNumber: randomUUID(), fullName: "Synthetic message lead", mobile: "+10000000001", branchId: branch.id } });
        const customer = await db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Synthetic message customer", phone: "+10000000002", whatsapp: "+10000000002", branchId: branch.id } });
        const quote = await db.quotation.create({ data: { quotationNumber: randomUUID(), customerId: customer.id, branchId: branch.id } });
        const cases = [
          { path: `/api/v1/crm/leads/${lead.id}/communications`, body: { channel: "WHATSAPP", send: true, message: "Synthetic lead message" } },
          { path: `/api/v1/crm/customers/${customer.id}/communications`, body: { channel: "WHATSAPP", send: true, message: "Synthetic customer message" } },
          { path: `/api/v1/crm/quotations/${quote.id}/send`, body: {} },
        ];
        for (const item of cases) {
          const key = randomUUID(), before = calls;
          const invalid = await post(item.path, item.body, "invalid");
          assert.equal(invalid.status, 400, item.path + " " + await invalid.text());
          assert.equal(calls, before);
          assert.equal((await post(item.path, item.body, key)).status, 502);
          assert.equal(calls, before + 1);
          assert.equal((await post(item.path, item.body, key)).status, 409);
          assert.equal((await post(item.path, item.body)).status, 409);
          assert.equal(calls, before + 1);
          const status = await fetch(origin + "/api/v1/comms/whatsapp/submission/" + key, { headers: { Authorization: `Bearer ${admin}` } });
          assert.equal(status.status, 200);
          assert.equal((await status.json()).status, "UNCERTAIN");
          const other = await fetch(origin + "/api/v1/comms/whatsapp/submission/" + key, { headers: { Authorization: `Bearer ${staff}` } });
          assert.equal(other.status, 404);
        }
        assert.equal(await db.communication.count({ where: { OR: [{ leadId: lead.id }, { customerId: customer.id }] } }), 0);
        assert.equal((await db.quotation.findUniqueOrThrow({ where: { id: quote.id } })).status, "DRAFT");
      } finally { wa.send = original; }
    });
    await t.test("email and communication-log retries reuse one submission", async () => {
      const mail = app.get(MailService), original = mail.send;
      let calls = 0;
      try {
        mail.send = async () => { calls++; return { accepted: ["synthetic@example.test"], messageId: "synthetic-mail-reference" }; };
        const customer = await db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Synthetic mail customer", email: "synthetic@example.test", branchId: branch.id } });
        const path = `/api/v1/crm/customers/${customer.id}/communications`, key = randomUUID();
        const body = { channel: "EMAIL", send: true, subject: "Synthetic", message: "Synthetic replay" };
        const one = await post(path, body, key), two = await post(path, body, key);
        assert.equal(one.status, 201); assert.equal(two.status, 201);
        assert.equal(calls, 1);
        assert.equal(await db.communication.count({ where: { customerId: customer.id } }), 1);
        assert.equal((await post(path, { ...body, message: "Changed" }, key)).status, 409);
        assert.equal(calls, 1);
      } finally { mail.send = original; }
    });
    await t.test("concurrent log-only retries create one row and reject changed delivery intent before SMTP", async () => {
      const customer = await db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Synthetic call log", email: "synthetic@example.test", branchId: branch.id } });
      const path = `/api/v1/crm/customers/${customer.id}/communications`, key = randomUUID();
      const body = { channel: "CALL", message: "Synthetic recorded call", send: false };
      const outboundBefore = await db.outboundMessage.count();
      assert.equal((await post(path, null as never)).status, 400);
      const responses = await Promise.all([post(path, body, key), post(path, body, key)]);
      assert.ok(responses.every(response => response.status === 201));
      const rows = await Promise.all(responses.map(response => response.json()));
      assert.equal(rows[0].communication.id, rows[1].communication.id);
      assert.equal(await db.communication.count({ where: { customerId: customer.id } }), 1);
      assert.equal((await post(path, { ...body, channel: "EMAIL", send: true }, key)).status, 409);
      assert.equal(await db.outboundMessage.count(), outboundBefore);
    });
    await t.test("a log write failure after SMTP acceptance rolls back logging and resumes without sending twice", async () => {
      const mail = app.get(MailService), original = mail.send; let calls = 0;
      const lead = await db.lead.create({ data: { leadNumber: randomUUID(), fullName: "Synthetic late log failure", mobile: "+10000000008", email: "synthetic@example.test", branchId: branch.id } });
      const path = `/api/v1/crm/leads/${lead.id}/communications`, body = { channel: "EMAIL", send: true, message: "Synthetic late log write" }, key = randomUUID();
      try {
        mail.send = async () => { calls++; return { accepted: ["synthetic@example.test"], messageId: "synthetic-before-log" }; };
        await db.$executeRaw`CREATE FUNCTION synthetic_fail_communication() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic communication insert failure'; END $$`;
        await db.$executeRaw`CREATE TRIGGER synthetic_fail_communication BEFORE INSERT ON "Communication" FOR EACH ROW EXECUTE FUNCTION synthetic_fail_communication()`;
        assert.equal((await post(path, body, key)).status, 500);
        assert.equal(await db.communication.count({ where: { leadId: lead.id } }), 0);
        assert.equal((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).status, "NEW");
        assert.equal(calls, 1);
      } finally {
        await db.$executeRaw`DROP TRIGGER IF EXISTS synthetic_fail_communication ON "Communication"`;
        await db.$executeRaw`DROP FUNCTION IF EXISTS synthetic_fail_communication()`;
        mail.send = original;
      }
      assert.equal((await post(path, body, key)).status, 201);
      assert.equal(calls, 1);
      assert.equal(await db.communication.count({ where: { leadId: lead.id } }), 1);
      assert.equal((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).status, "CONTACTED");
    });
    await t.test("partial quotation delivery replays each channel and records completion once", async () => {
      const mail = app.get(MailService), oldMail = mail.send, wa = app.get(WhatsAppService), oldWa = wa.send;
      let emailCalls = 0, waCalls = 0;
      try {
        mail.send = async () => { emailCalls++; return { accepted: ["synthetic@example.test"], messageId: "synthetic-quotation-mail" }; };
        wa.send = async () => { waCalls++; throw new BadGatewayException("Synthetic response lost"); };
        const customer = await db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Synthetic quote recipient", email: "synthetic@example.test", whatsapp: "+10000000009", branchId: branch.id } });
        const quote = await db.quotation.create({ data: { quotationNumber: randomUUID(), customerId: customer.id, branchId: branch.id } });
        const path = `/api/v1/crm/quotations/${quote.id}/send`, key = randomUUID();
        assert.equal((await post(path, {}, key)).status, 502);
        assert.equal((await post(path, {}, key)).status, 409);
        assert.equal(emailCalls, 1); assert.equal(waCalls, 1);
        const pending = await db.outboundMessage.findFirstOrThrow({ where: { channel: "WHATSAPP", status: "UNCERTAIN" }, orderBy: { createdAt: "desc" } });
        assert.equal((await post(`/api/v1/comms/whatsapp/${pending.id}/reconcile`, { status: "SENT", reason: "Synthetic provider confirms acceptance" })).status, 201);
        assert.equal((await post(path, {}, key)).status, 201);
        assert.equal((await post(path, {}, key)).status, 201);
        assert.equal(emailCalls, 1); assert.equal(waCalls, 1);
        assert.equal(await db.auditLog.count({ where: { entity: "quotation", entityId: quote.id, action: "SEND" } }), 1);
        assert.equal((await db.quotation.findUniqueOrThrow({ where: { id: quote.id } })).status, "SENT");
        const changed = await db.quotation.create({ data: { quotationNumber: randomUUID(), customerId: customer.id, branchId: branch.id } });
        mail.send = async () => { emailCalls++; await db.quotation.update({ where: { id: changed.id }, data: { status: "CONVERTED" } }); return { accepted: ["synthetic@example.test"] }; };
        wa.send = async () => ({ id: "synthetic-accepted" });
        assert.equal((await post(`/api/v1/crm/quotations/${changed.id}/send`, {}, randomUUID())).status, 409);
        assert.equal((await db.quotation.findUniqueOrThrow({ where: { id: changed.id } })).status, "CONVERTED");
      } finally { mail.send = oldMail; wa.send = oldWa; }
    });
    await t.test("loopback SMTP acceptance, lost acknowledgement, process restart and audited reconciliation never blindly resend", async () => {
      const capture = await smtpCapture();
      const keys = ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"];
      const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
      const mail = app.get(MailService), original = mail.send;
      try {
        Object.assign(process.env, { SMTP_HOST: "127.0.0.1", SMTP_PORT: String(capture.port), SMTP_SECURE: "false", SMTP_USER: "", SMTP_PASSWORD: "", SMTP_FROM: "synthetic@example.test" });
        const smtpMail = new MailService(); mail.send = smtpMail.send.bind(smtpMail);
        const body = { to: "synthetic@example.test", subject: "Synthetic SMTP", html: "<p>Synthetic acceptance</p>" }, key = randomUUID();
        const attempts = await Promise.all([post("/api/v1/comms/email", body, key), post("/api/v1/comms/email", body, key)]);
        assert.ok(attempts.every(response => [201, 409].includes(response.status)));
        assert.equal((await post("/api/v1/comms/email", body, key)).status, 201);
        assert.equal(capture.messages.length, 1);
        assert.equal((await post("/api/v1/comms/email", null as never)).status, 400);
        assert.equal((await post("/api/v1/comms/email", { ...body, subject: "Changed" }, key)).status, 409);
        for (const to of ["a@example.test,b@example.test", "group:a@example.test", "a@example.test\r\nBcc: b@example.test"]) assert.equal((await post("/api/v1/comms/email", { ...body, to })).status, 400);
        capture.setMode("lose-ack");
        const lost = { ...body, html: "<p>Synthetic lost acknowledgement</p>" }, lostKey = randomUUID();
        assert.equal((await post("/api/v1/comms/email", lost, lostKey)).status, 503);
        assert.equal(capture.messages.length, 2);
        const row = await db.outboundMessage.findFirstOrThrow({ where: { channel: "EMAIL", status: "UNCERTAIN" }, orderBy: { createdAt: "desc" } });
        const reviewPath = origin + "/api/v1/comms/submissions/" + encodeURIComponent(row.id);
        assert.equal((await fetch(reviewPath)).status, 401);
        const deniedReview = await fetch(reviewPath, { headers: { Authorization: `Bearer ${staff}` } });
        assert.equal(deniedReview.status, 403); assert.doesNotMatch(await deniedReview.text(), /fingerprint|providerReference|synthetic@example/);
        const permittedReview = await fetch(reviewPath, { headers: { Authorization: `Bearer ${admin}` } });
        assert.equal(permittedReview.status, 200);
        const metadata = await permittedReview.json(); assert.equal(metadata.channel, "EMAIL"); assert.equal(metadata.userId, row.userId); assert.equal(Object.hasOwn(metadata, "fingerprint"), false);
        assert.doesNotMatch(JSON.stringify(row), /synthetic@example|Synthetic lost|SMTP_PASSWORD/);
        await app.close(); app = await createNestApp(); await app.listen(0, "127.0.0.1"); origin = await app.getUrl();
        assert.equal((await post("/api/v1/comms/email", lost, lostKey)).status, 409);
        assert.equal((await post("/api/v1/comms/email", lost)).status, 409);
        assert.equal(capture.messages.length, 2);
        const statusPath = origin + "/api/v1/comms/email/submission/" + lostKey;
        assert.equal((await fetch(statusPath)).status, 401);
        assert.equal((await fetch(statusPath, { headers: { Authorization: `Bearer ${staff}` } })).status, 404);
        assert.equal((await fetch(statusPath, { headers: { Authorization: `Bearer ${admin}` } })).status, 200);
        assert.equal((await post(`/api/v1/comms/email/${row.id}/reconcile`, { status: "SENT", reason: "Synthetic confirmation" }, randomUUID(), staff)).status, 403);
        assert.equal((await post(`/api/v1/comms/whatsapp/${row.id}/reconcile`, { status: "SENT", reason: "Wrong channel" })).status, 404);
        assert.equal((await post(`/api/v1/comms/email/${row.id}/reconcile`, { status: "SENT", reason: "Synthetic capture confirms SMTP acceptance" })).status, 201);
        assert.equal((await post("/api/v1/comms/email", lost, lostKey)).status, 201);
        assert.equal(capture.messages.length, 2);
        assert.equal(await db.auditLog.count({ where: { action: "RECONCILE_EMAIL", entityId: row.id } }), 1);
        capture.setMode("reject");
        const rejected = { ...body, html: "<p>Synthetic rejected submission</p>" }, rejectedKey = randomUUID();
        assert.equal((await post("/api/v1/comms/email", rejected, rejectedKey)).status, 503);
        const rejectedRow = await db.outboundMessage.findFirstOrThrow({ where: { channel: "EMAIL", status: "UNCERTAIN" }, orderBy: { createdAt: "desc" } });
        await post(`/api/v1/comms/email/${rejectedRow.id}/reconcile`, { status: "NOT_SENT", reason: "Synthetic server confirms rejection before DATA" });
        assert.equal((await post("/api/v1/comms/email", rejected, rejectedKey)).status, 409);
        capture.setMode("accept");
        assert.equal((await post("/api/v1/comms/email", rejected)).status, 201);
        assert.equal(capture.messages.length, 3);
      } finally {
        mail.send = original;
        for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
        await capture.close();
      }
    });
    await t.test("representative synthetic query plans use the additive recent-auth and customer-ticket indexes",async()=>{
      const [privateTable] = await db.$queryRaw<{ enabled: boolean }[]>`SELECT relrowsecurity AS enabled FROM pg_class WHERE oid='"CommunicationSubmission"'::regclass`;
      assert.equal(privateTable.enabled, true);
      const grants = await db.$queryRaw<{ grantee: string }[]>`SELECT grantee FROM information_schema.role_table_grants WHERE table_name='CommunicationSubmission' AND grantee IN ('PUBLIC','anon','authenticated')`;
      assert.deepEqual(grants, []);
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



/** Disposable loopback SMTP fixture. Never connects to a remote provider. */
async function smtpCapture() {
  const messages: string[] = [], sockets = new Set<net.Socket>();
  let mode: "accept" | "lose-ack" | "reject" = "accept";
  const server = net.createServer(socket => {
    sockets.add(socket); socket.setEncoding("utf8");
    let pending = "", message = "", inData = false;
    socket.on("error", () => {});
    socket.on("close", () => sockets.delete(socket));
    socket.write("220 synthetic.local ESMTP\r\n");
    socket.on("data", chunk => {
      pending += chunk;
      let end: number;
      while ((end = pending.indexOf("\r\n")) !== -1) {
        const line = pending.slice(0, end); pending = pending.slice(end + 2);
        if (inData) {
          if (line === ".") {
            messages.push(message); message = ""; inData = false;
            if (mode === "lose-ack") socket.destroy();
            else socket.write("250 queued\r\n");
          } else message += line + "\r\n";
          continue;
        }
        const command = line.split(" ", 1)[0].toUpperCase();
        if (["EHLO", "HELO"].includes(command)) socket.write("250-synthetic.local\r\n250 SIZE 10485760\r\n");
        else if (command === "MAIL" && mode === "reject") socket.write("550 synthetic rejection\r\n");
        else if (command === "DATA") { inData = true; socket.write("354 end with dot\r\n"); }
        else if (command === "QUIT") { socket.write("221 bye\r\n"); socket.end(); }
        else socket.write("250 OK\r\n");
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  return {
    messages,
    port: (server.address() as net.AddressInfo).port,
    setMode(value: typeof mode) { mode = value; },
    async close() { for (const socket of sockets) socket.destroy(); await new Promise<void>(resolve => server.close(() => resolve())); },
  };
}
