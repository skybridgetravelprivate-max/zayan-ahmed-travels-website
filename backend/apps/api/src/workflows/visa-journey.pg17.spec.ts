import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PassThrough } from "node:stream";
import { buffer } from "node:stream/consumers";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { ResourcesService } from "../resources/resources.service";
import { SequenceService } from "../common/sequence.service";
import { AuditService } from "../common/audit.service";
import { PdfController } from "../documents/documents.controller";
import { DocumentPdfService } from "../documents/document-pdf.service";
import { WebsiteCustomerBookingsService } from "../website/website-customer-bookings.service";
import type { AuthUser } from "../auth/auth.types";
import type { Response } from "express";

test("PG17 visa intake, application status, private PDF and customer isolation", { skip: !process.env.ZAT_SYNTHETIC_DATABASE_URL }, async t => {
  const target = new URL(process.env.ZAT_SYNTHETIC_DATABASE_URL!);
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.port, "55463");
  assert.equal(target.pathname, "/zat_synthetic_manual_workflows");
  const db = new PrismaClient({ datasourceUrl: target.toString() });
  try {
    const [server] = await db.$queryRaw<{ version: number }[]>`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(server.version >= 170000 && server.version < 180000);
    const branch = await db.branch.create({ data: { code: randomUUID(), name: "Synthetic visa branch" } });
    const foreignBranch = await db.branch.create({ data: { code: randomUUID(), name: "Synthetic foreign visa branch" } });
    const staff = await db.user.create({ data: { username: randomUUID(), email: `${randomUUID()}@example.test`, fullName: "Synthetic visa staff", passwordHash: "invalid", defaultBranchId: branch.id } });
    const customer = await db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Synthetic visa traveler", branchId: branch.id } });
    const other = await db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Synthetic other traveler", branchId: foreignBranch.id } });
    const actor = { id: staff.id, isSuperAdmin: false, branchIds: [branch.id], defaultBranchId: branch.id, permissions: ["visa.view", "visa.create", "visa.edit", "document.view", "customer.view"] } as AuthUser;
    const foreign = { ...actor, branchIds: [foreignBranch.id], defaultBranchId: foreignBranch.id };
    const resources = new ResourcesService(db as never, new SequenceService(db as never), new AuditService(db as never));
    const bookings = new WebsiteCustomerBookingsService(db as never);
    const pdf = new PdfController(db as never, new DocumentPdfService(db as never));
    const financialBefore = { journals: await db.journalEntry.count(), receipts: await db.receipt.count() };
    const application = await resources.create("visa-applications", actor, { customerId: customer.id, branchId: branch.id, category: "VISIT", country: "Saudi Arabia", status: "DOCUMENT_PENDING", notes: "Synthetic internal application note" });
    const id = String(application.id);
    await t.test("intake is numbered and audited; foreign owner attachment and financial overposting fail", async () => {
      assert.match(String(application.applicationNo), /^ZAT-VS/);
      assert.equal(await db.auditLog.count({ where: { entityId: id, action: "CREATE" } }), 1);
      await assert.rejects(resources.create("visa-applications", actor, { customerId: other.id, branchId: branch.id, category: "VISIT", country: "Saudi Arabia" }));
      await assert.rejects(resources.update("visa-applications", id, actor, { sellingPrice: "999.00", cost: "10.00" }), { status: 400 });
      assert.equal((await db.visaApplication.findUniqueOrThrow({ where: { id } })).sellingPrice.toFixed(2), "0.00");
    });
    await t.test("existing statuses project Upcoming then Completed, without exposing notes or finance", async () => {
      for (const status of ["READY", "SUBMITTED", "PROCESSING", "APPROVED"] as const) {
        await resources.update("visa-applications", id, actor, { status, ...(status === "SUBMITTED" ? { submittedAt: "2031-01-02T00:00:00.000Z" } : {}) });
        const rows = (await bookings.listForWebsiteCustomer(customer.id)).bookings;
        const row = rows.find(item => item.reference === application.applicationNo)!;
        assert.ok(row);
        assert.equal(row.status, status === "APPROVED" ? "Completed" : "Upcoming");
        assert.deepEqual(Object.keys(row).sort(), ["reference", "service", "destination", "travelDate", "status", "createdAt", "updatedAt"].sort());
        assert.equal(row.service, "Visa");
      }
      assert.equal((await bookings.listForWebsiteCustomer(other.id)).bookings.some(row => row.reference === application.applicationNo), false);
    });
    await t.test("private application PDF renders; foreign branch cannot read, edit or render", async () => {
      const stream = new PassThrough();
      const headers: Record<string, string> = {};
      Object.assign(stream, { setHeader: (name: string, value: string) => { headers[name] = value; } });
      const read = buffer(stream);
      await pdf.visaApplication(id, stream as unknown as Response, { user: actor } as never);
      const bytes = await read;
      assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
      assert.equal(headers["Cache-Control"], "private, no-store");
      if (process.env.ZAT_SYNTHETIC_PDF_OUTPUT) {
        await mkdir(process.env.ZAT_SYNTHETIC_PDF_OUTPUT, { recursive: true });
        await writeFile(join(process.env.ZAT_SYNTHETIC_PDF_OUTPUT, "visa-application.pdf"), bytes);
      }
      await assert.rejects(resources.get("visa-applications", id, foreign), { status: 404 });
      await assert.rejects(resources.update("visa-applications", id, foreign, { status: "CANCELLED" }), { status: 404 });
      await assert.rejects(pdf.visaApplication(id, {} as Response, { user: foreign } as never), { status: 404 });
      assert.equal((await db.visaApplication.findUniqueOrThrow({ where: { id } })).status, "APPROVED");
    });
    await t.test("cancelled/rejected applications are customer-visible as Cancelled and create no invented financial entries", async () => {
      for (const status of ["CANCELLED", "REJECTED"] as const) {
        const record = await resources.create("visa-applications", actor, { customerId: customer.id, branchId: branch.id, category: "VISIT", country: "Saudi Arabia", status: "DOCUMENT_PENDING" });
        await resources.update("visa-applications", String(record.id), actor, { status });
        const row = (await bookings.listForWebsiteCustomer(customer.id)).bookings.find(item => item.reference === record.applicationNo)!;
        assert.equal(row.status, "Cancelled");
      }
      assert.deepEqual({ journals: await db.journalEntry.count(), receipts: await db.receipt.count() }, financialBefore);
    });
  } finally { await db.$disconnect(); }
});
