import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { PrismaService } from "../common/prisma.service";
import type { AuditService } from "../common/audit.service";
import type { AuthUser } from "../auth/auth.types";
import { assertPeopleLinksInBranch } from "../auth/record-scope";
import { submissionId } from "../common/submission-id";
import type { AccountingService } from "./accounting.service";
import { assertBaseCurrency } from "./base-currency";
import { invoiceLines, sumMoney } from "./invoice-lines";
import { money } from "./money";
import type { SequenceService } from "../common/sequence.service";

export function serviceVoucherInput(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new BadRequestException("Expected an invoice");
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some(k => !["date", "branchId", "customerId", "supplierId", "notes", "tax", "discount", "lines"].includes(k))) throw new BadRequestException("Unsupported invoice field");
  const reference = (value: unknown, required = false) => {
    if (!required && (value === undefined || value === null || value === "")) return undefined;
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) throw new BadRequestException("Select a valid invoice account");
    return value;
  };
  if (typeof input.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0, 10) !== input.date) throw new BadRequestException("A valid invoice date is required");
  if (input.notes !== undefined && (typeof input.notes !== "string" || input.notes.length > 2000)) throw new BadRequestException("Invoice notes must be at most 2000 characters");
  if (!Array.isArray(input.lines) || input.lines.some(line => !line || typeof line !== "object" || Array.isArray(line) || Object.keys(line).some(k => !["serviceId", "description", "qty", "unitPrice", "cost"].includes(k)) || !["string", "number"].includes(typeof line.cost) || !["string", "number"].includes(typeof line.unitPrice))) throw new BadRequestException("Provide selling and buying rates for each invoice line");
  const lines = invoiceLines(input.lines);
  const sellingPrice = sumMoney(lines.map(line => line.amount));
  const cost = sumMoney(lines.map(line => line.cost));
  const scalar = (value: unknown) => { if (value !== undefined && !["string", "number"].includes(typeof value)) throw new BadRequestException("Use exact invoice amounts"); return money(value ?? 0); };
  const tax = scalar(input.tax), discount = scalar(input.discount);
  const net = money(sellingPrice.plus(tax).minus(discount));
  const supplierId = reference(input.supplierId, cost.greaterThan(0));
  return { date: input.date, branchId: reference(input.branchId), customerId: reference(input.customerId, true)!, supplierId, notes: typeof input.notes === "string" ? input.notes.trim() : "", tax, discount, net, cost, sellingPrice, lines };
}

export async function postServiceVoucher(db: PrismaService, seq: SequenceService, accounting: AccountingService, audit: AuditService, user: AuthUser, body: unknown, key: unknown) {
  const id = submissionId("service-voucher", [user.id], key).replace(":", "_");
  const input = serviceVoucherInput(body);
  const branchId = input.branchId || user.defaultBranchId;
  const hash = createHash("sha256").update(JSON.stringify({ ...input, branchId: branchId ?? null })).digest("hex");
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${id}))`;
    const saved = await tx.serviceInvoice.findUnique({ where: { id }, include: { lines: true } });
    if (saved) {
      const proof = await tx.auditLog.findUnique({ where: { id } });
      if ((proof?.after as { requestHash?: string } | null)?.requestHash !== hash) throw new ConflictException("Invoice submission changed or requires review. Do not post again.");
      return saved;
    }
    if (!branchId) throw new BadRequestException("Select an invoice branch or set your default branch");
    await tx.$queryRaw`SELECT id FROM "Branch" WHERE id = ${branchId} FOR SHARE`;
    const branch = await tx.branch.findUnique({ where: { id: branchId } });
    if (!branch || branch.status !== "ACTIVE") throw new NotFoundException("Invoice branch unavailable");
    await assertBaseCurrency(tx, { currency: "PKR" });
    await tx.$queryRaw`SELECT id FROM "Customer" WHERE id = ${input.customerId} FOR SHARE`;
    const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
    if (!customer || customer.deletedAt) throw new NotFoundException("Invoice customer unavailable");
    await assertPeopleLinksInBranch(tx, input, branchId);
    if (input.supplierId) {
      await tx.$queryRaw`SELECT id FROM "Supplier" WHERE id = ${input.supplierId} FOR SHARE`;
      const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId } });
      if (!supplier || supplier.deletedAt || supplier.status !== "ACTIVE") throw new NotFoundException("Invoice supplier unavailable");
    }
    for (const line of input.lines) {
      if (line.serviceId) {
        const service = await tx.service.findUnique({ where: { id: line.serviceId } });
        if (!service || service.deletedAt || service.status !== "ACTIVE") throw new NotFoundException("Invoice service unavailable");
      }
    }
    const date = new Date(input.date);
    const invoice = await tx.serviceInvoice.create({ data: { id, invoiceNumber: await seq.next("inv", "INV", tx), date, customerId: input.customerId, supplierId: input.supplierId, branchId, status: "POSTED", notes: input.notes, tax: input.tax, discount: input.discount, cost: input.cost, sellingPrice: input.sellingPrice, net: input.net, lines: { create: input.lines.map(line => ({ serviceId: line.serviceId, description: line.description, qty: line.qty, unitPrice: line.unitPrice, unitCost: line.cost.div(line.qty), amount: line.amount })) } }, include: { lines: true } });
    const sale = await accounting.postSale({ db: tx, userId: user.id, module: "service", sourceId: invoice.id, amount: input.net, customerId: input.customerId, branchId, date, memo: `Service invoice ${invoice.invoiceNumber}` });
    await accounting.postCost({ db: tx, userId: user.id, module: "service", sourceId: invoice.id, amount: input.cost, supplierId: input.supplierId, branchId, date, memo: `Service cost ${invoice.invoiceNumber}` });
    const result = await tx.serviceInvoice.update({ where: { id }, data: { journalId: sale?.id }, include: { lines: true } });
    await audit.log({ id, db: tx, userId: user.id, action: "SUBMIT_SERVICE_INVOICE", entity: "serviceInvoice", entityId: id, after: { requestHash: hash } });
    return result;
  });
}
