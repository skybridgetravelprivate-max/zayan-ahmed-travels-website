import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Writable } from "node:stream";
import { finished } from "node:stream/promises";
import { test } from "node:test";
import { Prisma, PrismaClient } from "@prisma/client";
import { CrmService } from "./crm.service";
import { CrmScopeGuard } from "./crm-scope.guard";
import { SequenceService } from "../common/sequence.service";
import { AuditService } from "../common/audit.service";
import { AccountingService } from "../finance/accounting.service";
import { FinanceController } from "../finance/finance.controller";
import { GlobalFinanceGuard } from "../auth/global-finance.guard";
import { WorkflowsController } from "../workflows/workflows.controller";
import { PdfController } from "../documents/documents.controller";
import { DocumentPdfService } from "../documents/document-pdf.service";
import { WebsiteCustomerBookingsService } from "../website/website-customer-bookings.service";
import { WebsiteCustomerBookingsController } from "../website/website-customer-bookings.controller";
import type { AuthUser } from "../auth/auth.types";

const url = process.env.ZAT_SYNTHETIC_DATABASE_URL;
test("PG17 quotation journey", { skip: !url }, async t => {
  const target = new URL(url!);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname));
  assert.match(target.pathname, /^\/zat_synthetic_[a-z0-9_]+$/);
  const db = new PrismaClient({ datasourceUrl: url });
  try {
    const [server] = await db.$queryRaw<{ version: number }[]>`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(server.version >= 170000 && server.version < 180000);
    for (const [code, type] of [["1100", "ASSET"], ["1300", "ASSET"], ["2100", "LIABILITY"], ["4100", "REVENUE"], ["5100", "EXPENSE"]] as const) {
      await db.chartOfAccount.upsert({ where: { code }, update: {}, create: { code, name: `Synthetic ${code}`, type } });
    }
    const branch = await db.branch.create({ data: { code: randomUUID(), name: "Synthetic branch" } });
    const foreign = await db.branch.create({ data: { code: randomUUID(), name: "Other synthetic branch" } });
    const user = await db.user.create({ data: { email: `${randomUUID()}@example.test`, username: randomUUID(), fullName: "Synthetic staff", passwordHash: "invalid" } });
    const actor: AuthUser = { id: user.id, email: user.email, username: user.username, fullName: user.fullName, permissions: ["quotation.view", "booking.view", "account.view"], roleNames: [], branchIds: [branch.id], defaultBranchId: branch.id, isSuperAdmin: false };
    const outsider = { ...actor, branchIds: [foreign.id], defaultBranchId: foreign.id };
    const req = { user: actor } as never;
    const financeReq = { user: { ...actor, isSuperAdmin: true, roleNames: ["SUPER_ADMIN"] } } as never;
    const seq = new SequenceService(db as never), audit = new AuditService(db as never);
    const accounting = new AccountingService(db as never, seq, audit);
    const crm = new CrmService(db as never, seq, audit, {} as never, {} as never, {} as never, accounting);
    const workflow = new WorkflowsController(db as never, seq, audit, accounting, {} as never);
    const finance = new FinanceController(db as never, seq, audit, accounting);
    const visible = new WebsiteCustomerBookingsService(db as never);
    const pdf = new PdfController(db as never, new DocumentPdfService(db as never));
    const lead = async () => db.lead.create({ data: { leadNumber: randomUUID(), fullName: "Synthetic traveler", mobile: "+923000000000", email: `${randomUUID()}@example.test`, adults: 3, budget: 120000.03, branchId: branch.id, travelDate: new Date("2030-01-10T00:00:00Z"), returnDate: new Date("2030-01-20T00:00:00Z") } });
    const counts = async () => Promise.all([db.customer.count(), db.quotation.count(), db.quotationItem.count(), db.umrahBooking.count(), db.receipt.count(), db.journalEntry.count(), db.auditLog.count(), db.numberSequence.findMany({ orderBy: { key: "asc" } })]);
    const original = await lead();
    const quote = await crm.quoteFromLead(original.id, actor);
    let booking: Awaited<ReturnType<typeof workflow.convertQuote>>;
    let receipt: Awaited<ReturnType<typeof finance.createReceipt>>;

    await t.test("package budget, concurrent customer conversion and quotation edits", async () => {
      const customers = await Promise.all([crm.convertLead(original.id, actor), crm.convertLead(original.id, actor)]);
      assert.equal(customers[0].id, customers[1].id);
      assert.equal(customers[0].id, quote.customerId);
      assert.equal(await db.customer.count({ where: { leadId: original.id } }), 1);
      const edited = await crm.updateQuotation(quote.id, actor, { discount: 100.03, tax: 50, terms: "Synthetic terms" });
      assert.equal(edited.net.toFixed(2), "119950.00");
      await Promise.all([crm.addQuoteItem(quote.id, { description: "Extra A", sellingPrice: 0.1, cost: 10 }), crm.addQuoteItem(quote.id, { description: "Extra B", sellingPrice: 0.2, cost: 20 })]);
      const q = await db.quotation.findUniqueOrThrow({ where: { id: quote.id }, include: { items: true } });
      assert.equal(q.net.toFixed(2), "119950.30");
      assert.equal(q.costTotal.toFixed(2), "30.00");
    });
    await t.test("invalid edits and failed audits leave totals, items, audit and sequences unchanged", async () => {
      const before = await counts();
      const q = await db.quotation.findUniqueOrThrow({ where: { id: quote.id } });
      for (const discount of [-1, Number.NaN, 999999]) await assert.rejects(crm.updateQuotation(quote.id, actor, { discount }));
      const broken = new CrmService(db as never, seq, { log: async () => { throw Error("synthetic audit failure"); } } as never, {} as never, {} as never, {} as never, accounting);
      await assert.rejects(broken.updateQuotation(quote.id, actor, { tax: 99 }), /synthetic audit failure/);
      assert.deepEqual(await db.quotation.findUniqueOrThrow({ where: { id: quote.id } }), q);
      assert.deepEqual(await counts(), before);
    });
    await t.test("branch guard denies foreign quotation edits and conversion", async () => {
      const context = { switchToHttp: () => ({ getRequest: () => ({ user: outsider, route: { path: "/v1/crm/quotations/:id" }, params: { id: quote.id }, method: "PATCH" }) }) } as never;
      await assert.rejects(new CrmScopeGuard(db as never).canActivate(context), { status: 404 });
      await assert.rejects(workflow.convertQuote(quote.id, { user: outsider } as never), { status: 404 });
      await assert.rejects(crm.quoteFromLead(original.id, outsider), { status: 404 });
      assert.throws(() => new GlobalFinanceGuard().canActivate({ switchToHttp: () => ({ getRequest: () => ({ user: actor }) }) } as never), { status: 403 });
    });
    await t.test("concurrent and repeat conversion create one booking and balanced sale/cost journals", async () => {
      const rows = await Promise.all([workflow.convertQuote(quote.id, req), workflow.convertQuote(quote.id, req)]);
      booking = rows[0]; assert.equal(rows[0].id, rows[1].id);
      assert.equal((await workflow.convertQuote(quote.id, req)).id, booking.id);
      assert.equal(await db.umrahBooking.count({ where: { quotationId: quote.id } }), 1);
      assert.equal(booking.net.toFixed(2), "119950.30");
      assert.equal(booking.balance.toFixed(2), "119950.30");
      assert.equal(booking.cost.toFixed(2), "30.00");
      assert.equal(booking.departureDate?.toISOString(), original.travelDate?.toISOString());
      assert.equal(booking.returnDate?.toISOString(), original.returnDate?.toISOString());
      const journals = await db.journalEntry.findMany({ where: { sourceId: booking.id }, include: { lines: true } });
      assert.equal(journals.length, 2);
      for (const journal of journals) assert.equal(journal.lines.reduce((s, l) => s.plus(l.debit).minus(l.credit), new Prisma.Decimal(0)).toFixed(2), "0.00");
    });
    await t.test("converted quotations cannot be edited, have lines removed/added, or reopened", async () => {
      const before = await counts();
      const item = await db.quotationItem.findFirstOrThrow({ where: { quotationId: quote.id } });
      await assert.rejects(crm.updateQuotation(quote.id, actor, { tax: 1 }), { status: 409 });
      await assert.rejects(crm.addQuoteItem(quote.id, { description: "late" }), { status: 409 });
      await assert.rejects(crm.removeQuoteItem(quote.id, item.id), { status: 409 });
      await assert.rejects(crm.setQuotationStatus(quote.id, "DRAFT", actor), { status: 409 });
      assert.deepEqual(await counts(), before);
    });
    await t.test("conversion and initial quotation creation roll back on injected failure", async () => {
      const l = await lead();
      const q = await crm.quoteFromLead(l.id, actor);
      const before = await counts();
      const brokenAccounting = new Proxy(accounting, { get(target, key) { if (key === "postCost") return async () => { throw Error("synthetic cost failure"); }; const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value; } });
      const broken = new WorkflowsController(db as never, seq, audit, brokenAccounting, {} as never);
      await assert.rejects(broken.convertQuote(q.id, req), /synthetic cost failure/);
      assert.deepEqual(await counts(), before);
      assert.equal((await db.quotation.findUniqueOrThrow({ where: { id: q.id } })).status, "DRAFT");
      const newLead = await lead();
      const failedSeq = { next: async (key: string, prefix: string, tx: never) => { if (key === "quotation") throw Error("synthetic sequence failure"); return seq.next(key, prefix, tx); } };
      const failedCrm = new CrmService(db as never, failedSeq as never, audit, {} as never, {} as never, {} as never, accounting);
      const snapshot = await counts();
      await assert.rejects(failedCrm.quoteFromLead(newLead.id, actor), /synthetic sequence failure/);
      assert.deepEqual(await counts(), snapshot);
      assert.equal((await db.lead.findUniqueOrThrow({ where: { id: newLead.id } })).status, "NEW");
    });
    await t.test("keyed duplicate receipts post once; conflicting replay and overpayment are rejected", async () => {
      const body = { bookingId: booking.id, amount: 10000.1, method: "CASH" };
      const key = randomUUID();
      await assert.rejects(finance.createReceipt(body, req, key), { status: 403 });

      const results = await Promise.all([finance.createReceipt(body, financeReq, key), finance.createReceipt(body, financeReq, key)]);
      receipt = results[0]; assert.equal(results[0].id, results[1].id);
      assert.equal((await finance.createReceipt(body, financeReq, key)).id, receipt.id);
      await assert.rejects(finance.createReceipt({ ...body, amount: 1 }, financeReq, key), { status: 409 });
      const current = await db.umrahBooking.findUniqueOrThrow({ where: { id: booking.id } });
      assert.equal(current.paid.toFixed(2), "10000.10"); assert.equal(current.balance.toFixed(2), "109950.20");
      assert.equal(await db.receipt.count({ where: { bookingId: booking.id } }), 1);
      const j = await db.journalEntry.findUniqueOrThrow({ where: { id: receipt.journalId! }, include: { lines: true } });
      assert.equal(j.lines.reduce((sum, l) => sum.plus(l.debit).minus(l.credit), new Prisma.Decimal(0)).toFixed(2), "0.00");
      const before = await counts();
      await assert.rejects(finance.createReceipt({ ...body, amount: 200000 }, financeReq, randomUUID()));
      await assert.rejects(finance.createReceipt({ ...body, customerId: "other-customer" }, financeReq, randomUUID()));
      await assert.rejects(finance.createReceipt(body, { user: outsider } as never, randomUUID()));
      assert.deepEqual(await counts(), before);
    });
    await t.test("receipt failure rolls back journals, paid/balance, sequences and audit", async () => {
      await finance.reviewReceipt(receipt.id, { reviewed: true }, financeReq);
      const broken = new FinanceController(db as never, seq, { log: async () => { throw Error("synthetic receipt audit failure"); } } as never, accounting);
      const before = await counts(), current = await db.umrahBooking.findUniqueOrThrow({ where: { id: booking.id } });
      await assert.rejects(broken.createReceipt({ bookingId: booking.id, amount: 1, method: "CASH" }, financeReq, randomUUID()), /synthetic receipt audit failure/);
      assert.deepEqual(await counts(), before);
      assert.deepEqual(await db.umrahBooking.findUniqueOrThrow({ where: { id: booking.id } }), current);
    });
    await t.test("reviewed payments retain both amounts without regressing voucher workflow", async () => {
      await db.umrahBooking.update({ where: { id: booking.id }, data: { workflowStep: "VOUCHERS", status: "READY" } });
      const first = await finance.createReceipt({ bookingId: booking.id, amount: 1, method: "CASH" }, financeReq, randomUUID());
      await finance.reviewReceipt(first.id, { reviewed: true }, financeReq);
      await finance.createReceipt({ bookingId: booking.id, amount: 2, method: "CASH" }, financeReq, randomUUID());
      const current = await db.umrahBooking.findUniqueOrThrow({ where: { id: booking.id } });
      assert.equal(current.paid.toFixed(2), "10003.10");
      assert.equal(current.balance.toFixed(2), "109947.20");
      assert.equal(current.workflowStep, "VOUCHERS");
      assert.equal(current.status, "READY");
      const journals = await db.journalEntry.findMany({ where: { sourceId: booking.id }, include: { lines: { include: { account: true } } } });
      for (const journal of journals) assert.equal(journal.lines.reduce((sum, line) => sum.plus(line.debit).minus(line.credit), new Prisma.Decimal(0)).toFixed(2), "0.00");
      const receivable = journals.flatMap(journal => journal.lines).filter(line => line.account.code === "1300").reduce((sum, line) => sum.plus(line.debit).minus(line.credit), new Prisma.Decimal(0));
      assert.equal(receivable.toFixed(2), current.balance.toFixed(2));
    });
    await t.test("customer without a lead uses the shared quotation conversion and accounting exactly once", async () => {
      const customer = await db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Synthetic direct customer", branchId: branch.id } });
      const q = await crm.quoteFromCustomer(customer.id, actor);
      await crm.addQuoteItem(q.id, { description: "Synthetic package", sellingPrice: 100, cost: 40 });
      const rows = await Promise.all([crm.bookingFromCustomer(customer.id, actor), crm.bookingFromCustomer(customer.id, actor)]);
      assert.equal(rows[0].id, rows[1].id);
      assert.equal(rows[0].cost.toFixed(2), "40.00");
      assert.equal(rows[0].net.toFixed(2), "100.00");
      assert.equal(rows[0].status, "CONFIRMED");
      assert.equal(await db.journalEntry.count({ where: { sourceId: rows[0].id } }), 2);
      assert.equal((await db.quotation.findUniqueOrThrow({ where: { id: q.id } })).status, "CONVERTED");
      await assert.rejects(crm.bookingFromCustomer(customer.id, outsider), { status: 404 });
    });
    await t.test("customer account list includes converted travel dates and isolates other customers", async () => {
      const rows = await visible.listForWebsiteCustomer(quote.customerId!);
      assert.equal(rows.bookings.length, 1); assert.equal(rows.bookings[0].reference, booking.bookingNumber);
      assert.equal(rows.bookings[0].travelDate, "2030-01-10");
      assert.deepEqual(Object.keys(rows.bookings[0]).sort(), ["reference", "service", "destination", "travelDate", "status", "createdAt", "updatedAt"].sort());
      const other = await crm.convertLead((await lead()).id, actor);
      assert.deepEqual(await visible.listForWebsiteCustomer(other.id), { bookings: [] });
      const prior = process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN;
      process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN = "synthetic-internal-token-with-at-least-32-characters";
      try { assert.throws(() => new WebsiteCustomerBookingsController(visible).list(quote.customerId!, "invalid")); }
      finally { if (prior === undefined) delete process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN; else process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN = prior; }
    });
    await t.test("quotation, receipt and voucher render PDFs in both price modes; foreign branch denied", async () => {
      for (const [name, id] of [["quotation", quote.id], ["receipt", receipt.id], ["umrahVoucher", booking.id]] as const) {
        for (const mode of ["INCLUDED", "EXCLUDED"]) {
          const chunks: Buffer[] = [], headers = new Map<string, string>();
          const output = new Writable({ write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); } });
          const response = Object.assign(output, { setHeader: (key: string, value: string) => headers.set(key, value) });
          await pdf[name](id, mode, response as never, req); await finished(output);
          const bytes = Buffer.concat(chunks);
          assert.ok(bytes.subarray(0, 5).equals(Buffer.from("%PDF-")));
          assert.equal(headers.get("Cache-Control"), "private, no-store");
          if (process.env.ZAT_SYNTHETIC_PDF_DIR) { await mkdir(process.env.ZAT_SYNTHETIC_PDF_DIR, { recursive: true }); await writeFile(join(process.env.ZAT_SYNTHETIC_PDF_DIR, `${name}-${mode}.pdf`), bytes); }
        }
        await assert.rejects(pdf[name](id, "INCLUDED", {} as never, { user: outsider } as never), { status: 404 });
      }
    });
  } finally { await db.$disconnect(); }
});
