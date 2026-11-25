import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PassThrough } from "node:stream";
import { buffer } from "node:stream/consumers";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";
import { WorkflowsController } from "./workflows.controller";
import { AccountingService } from "../finance/accounting.service";
import { ReceiptOperations } from "../finance/receipt-operations";
import { SequenceService } from "../common/sequence.service";
import { AuditService } from "../common/audit.service";
import { PdfController } from "../documents/documents.controller";
import { DocumentPdfService } from "../documents/document-pdf.service";
import { WebsiteCustomerBookingsService } from "../website/website-customer-bookings.service";
import { ReportsService } from "../reports/reports.service";
import type { AuthUser } from "../auth/auth.types";
import type { Response } from "express";

test("PG17 ticket issuance, settlement, customer projection, PDFs and refund credit", { skip: !process.env.ZAT_SYNTHETIC_DATABASE_URL }, async t => {
  const target = new URL(process.env.ZAT_SYNTHETIC_DATABASE_URL!);
  assert.equal(target.hostname, "127.0.0.1"); assert.equal(target.port, "55463");
  assert.equal(target.pathname, "/zat_synthetic_manual_workflows");
  const db = new PrismaClient({ datasourceUrl: target.toString() });
  try {
    const [server] = await db.$queryRaw<{ version: number }[]>`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(server.version >= 170000 && server.version < 180000);
    for (const [code, type] of [["1100", "ASSET"], ["1200", "ASSET"], ["1300", "ASSET"], ["2100", "LIABILITY"], ["4200", "REVENUE"], ["5100", "EXPENSE"]] as const) {
      await db.chartOfAccount.upsert({ where: { code }, update: {}, create: { code, name: "Synthetic ticket account", type } });
    }
    const branch = await db.branch.create({ data: { code: randomUUID(), name: "Synthetic ticket journey branch" } });
    const foreignBranch = await db.branch.create({ data: { code: randomUUID(), name: "Synthetic foreign ticket branch" } });
    const staff = await db.user.create({ data: { username: randomUUID(), email: `${randomUUID()}@example.test`, fullName: "Synthetic ticket staff", passwordHash: "invalid", defaultBranchId: branch.id } });
    const customer = await db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Synthetic ticket traveler", branchId: branch.id } });
    const other = await db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Synthetic other ticket traveler", branchId: foreignBranch.id } });
    const actor = { id: staff.id, isSuperAdmin: true, branchIds: [branch.id], defaultBranchId: branch.id } as AuthUser;
    const viewer = { ...actor, isSuperAdmin: false, permissions: ["ticket.view", "ticket.refund", "document.view"] };
    const foreign = { ...viewer, branchIds: [foreignBranch.id], defaultBranchId: foreignBranch.id };
    const req = { user: actor } as never;
    const seq = new SequenceService(db as never), audit = new AuditService(db as never);
    const accounting = new AccountingService(db as never, seq, audit);
    const workflows = new WorkflowsController(db as never, seq, audit, accounting, {} as never);
    const receipts = new ReceiptOperations(db as never, seq, audit, accounting);
    const bookings = new WebsiteCustomerBookingsService(db as never);
    const reports = new ReportsService(db as never, accounting);
    const pdf = new PdfController(db as never, new DocumentPdfService(db as never));
    const number = "SYN-" + randomUUID();
    const issue = { ticketNumber: number, customerId: customer.id, branchId: branch.id, sector: "ISB-JED", departureAt: "2035-04-01T12:00:00.000Z", fare: "100.50", cost: "60.25", paidAmount: "30.25", paymentMethod: "CASH" };
    const issueKey = randomUUID();
    const ticket = await workflows.sellTicket(issue, req, issueKey);
    const arBalance = async () => (await accounting.arAp("customer")).find(row => row.partyId === customer.id)?.balance ?? "0.00";
    const customerRow = async () => (await bookings.listForWebsiteCustomer(customer.id)).bookings.find(row => row.reference === number)!;
    const financialCounts = async () => ({ journals: await db.journalEntry.count(), receipts: await db.receipt.count(), refunds: await db.ticketRefund.count() });
    async function render(kind: "invoice" | "refund", id: string, mode: "INCLUDED" | "EXCLUDED") {
      const stream = new PassThrough(), headers: Record<string, string> = {};
      Object.assign(stream, { setHeader: (name: string, value: string) => { headers[name] = value; } });
      const output = buffer(stream);
      if (kind === "invoice") await pdf.ticketInvoice(id, mode, stream as unknown as Response, { user: viewer } as never);
      else await pdf.ticketRefund(id, mode, stream as unknown as Response, { user: viewer } as never);
      const bytes = await output;
      assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
      assert.equal(headers["Cache-Control"], "private, no-store");
      if (process.env.ZAT_SYNTHETIC_PDF_OUTPUT) {
        await mkdir(process.env.ZAT_SYNTHETIC_PDF_OUTPUT, { recursive: true });
        await writeFile(join(process.env.ZAT_SYNTHETIC_PDF_OUTPUT, `ticket-${kind}-${mode}.pdf`), bytes);
      }
    }
    await t.test("issuance and lost-response retry preserve one ticket, one initial receipt and exact AR", async () => {
      assert.equal((await workflows.sellTicket(issue, req, issueKey)).id, ticket.id);
      assert.equal(await db.ticketSale.count({ where: { ticketNumber: number } }), 1);
      assert.equal(await db.receipt.count({ where: { ticketSaleId: ticket.id } }), 1);
      assert.equal(ticket.paidAmount.toFixed(2), "30.25");
      assert.equal(await arBalance(), "70.25");
      assert.equal((await customerRow()).status, "Completed"); // Existing ISSUED projection, not proof of flown travel.
      assert.equal((await bookings.listForWebsiteCustomer(other.id)).bookings.some(row => row.reference === number), false);
      for (const mode of ["INCLUDED", "EXCLUDED"] as const) await render("invoice", ticket.id, mode);
    });
    await t.test("settlement retry creates one additional receipt, settles AR and blocks overpayment", async () => {
      const key = randomUUID(), body = { ticketSaleId: ticket.id, amount: 70.25, method: "BANK" };
      await assert.rejects(receipts.create(body, actor, key), { status: 409 });
      const initial = await db.receipt.findFirstOrThrow({ where: { ticketSaleId: ticket.id } });
      await receipts.review(initial.id, true, actor);
      const first = await receipts.create(body, actor, key);
      assert.equal((await receipts.create(body, actor, key)).id, first.id);
      assert.equal(await db.receipt.count({ where: { ticketSaleId: ticket.id } }), 2);
      assert.equal((await db.ticketSale.findUniqueOrThrow({ where: { id: ticket.id } })).paymentStatus, "PAID");
      assert.equal(await arBalance(), "0.00");
      await receipts.review(first.id, true, actor);
      await assert.rejects(receipts.create({ ...body, amount: 0.01 }, actor, randomUUID()), { status: 400 });
    });
    await t.test("foreign branch cannot render or refund and makes no financial writes", async () => {
      const before = await financialCounts();
      await assert.rejects(pdf.ticketInvoice(ticket.id, "INCLUDED", {} as Response, { user: foreign } as never), { status: 404 });
      await assert.rejects(workflows.refund(ticket.id, { refundAmount: 100.50, reason: "Synthetic denial" }, { user: foreign } as never, randomUUID()), { status: 404 });
      assert.deepEqual(await financialCounts(), before);
    });
    await t.test("same-branch ticket with a foreign customer cannot post refund credit across branches", async () => {
      const linked = await db.ticketSale.create({ data: {
        ticketNumber: "SYN-LEGACY-" + randomUUID(), branchId: branch.id, customerId: other.id,
        fare: "10.00", net: "10.00", paidAmount: "10.00", status: "ISSUED", paymentStatus: "PAID",
      } });
      const before = await financialCounts();
      await assert.rejects(workflows.refund(linked.id, { refundAmount: 10, reason: "Synthetic linked-owner denial" }, { user: viewer } as never, randomUUID()), { status: 404 });
      assert.deepEqual(await financialCounts(), before);
      assert.equal((await db.ticketSale.findUniqueOrThrow({ where: { id: linked.id } })).status, "ISSUED");
    });
    let refundId = "";
    await t.test("missing keys and invalid exact decimal inputs cannot write refunds", async () => {
      const before = await financialCounts();
      await assert.rejects(workflows.refund(ticket.id, { refundAmount: "1.00", reason: "Synthetic missing key" }, req), { status: 400 });
      for (const refundAmount of ["1.001", "1e1", "-1", "NaN", "99999999999999999.00", [1], { amount: 1 }] as const) {
        await assert.rejects(workflows.refund(ticket.id, { refundAmount, reason: "Synthetic invalid amount" } as never, req, randomUUID()), { status: 400 });
      }
      assert.deepEqual(await financialCounts(), before);
    });
    await t.test("partial then final refunds retain paid receipt history and create customer credit once", async () => {
      const partialKey = randomUUID();
      const partialBody = { refundAmount: "40.25", reason: "Synthetic partial refund" };
      const [partial, concurrent] = await Promise.all([
        workflows.refund(ticket.id, partialBody, req, partialKey),
        workflows.refund(ticket.id, partialBody, req, partialKey),
      ]);
      assert.equal(partial.id, concurrent.id);
      assert.equal(await db.ticketRefund.count({ where: { ticketId: ticket.id } }), 1);
      const afterPartial = await financialCounts();
      assert.equal((await workflows.refund(ticket.id, { ...partialBody, refundAmount: 40.25 }, req, partialKey)).id, partial.id);
      await assert.rejects(workflows.refund(ticket.id, { ...partialBody, refundAmount: "41.25" }, req, partialKey), { status: 409 });
      await assert.rejects(workflows.refund(ticket.id, { ...partialBody, reason: "Changed reason" }, req, partialKey), { status: 409 });
      await assert.rejects(workflows.refund(ticket.id, partialBody, { user: foreign } as never, partialKey), { status: 404 });
      assert.deepEqual(await financialCounts(), afterPartial);
      assert.equal((await db.ticketSale.findUniqueOrThrow({ where: { id: ticket.id } })).status, "ISSUED");
      assert.equal(await arBalance(), "-40.25");
      const finalKey = randomUUID();
      const finalBody = { refundAmount: "60.25", reason: "Synthetic final refund" };
      const final = await workflows.refund(ticket.id, finalBody, req, finalKey);
      refundId = final.id;
      assert.equal((await db.ticketSale.findUniqueOrThrow({ where: { id: ticket.id } })).status, "REFUNDED");
      assert.equal((await customerRow()).status, "Cancelled");
      assert.equal(await arBalance(), "-100.50");
      assert.equal(await db.receipt.count({ where: { ticketSaleId: ticket.id } }), 2);
      const before = await financialCounts();
      assert.equal((await workflows.refund(ticket.id, finalBody, req, finalKey)).id, final.id);
      assert.deepEqual(await financialCounts(), before);
      await assert.rejects(workflows.refund(ticket.id, { refundAmount: 0.01, reason: "Synthetic retry" }, req, randomUUID()), { status: 400 });
      assert.deepEqual(await financialCounts(), before);
      for (const mode of ["INCLUDED", "EXCLUDED"] as const) await render("refund", refundId, mode);
      await assert.rejects(pdf.ticketRefund(refundId, "INCLUDED", {} as Response, { user: foreign } as never), { status: 404 });
    });
    await t.test("receivables report retains the credit and every journey journal balances exactly", async () => {
      const report = await reports.run("receivables", {});
      assert.equal(report.rows.find(row => row.clientId === customer.id)?.debit, "-100.50");
      const journals = await db.journalEntry.findMany({ where: { branchId: branch.id }, include: { lines: true } });
      assert.ok(journals.length >= 6);
      for (const journal of journals) {
        const sum = (field: "debit" | "credit") => journal.lines.reduce((total, line) => total.plus(line[field]), new Prisma.Decimal(0));
        assert.ok(sum("debit").equals(sum("credit")));
      }
    });
  } finally { await db.$disconnect(); }
});
