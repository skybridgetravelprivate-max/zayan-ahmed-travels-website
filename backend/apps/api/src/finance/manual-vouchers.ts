import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { PrismaService } from "../common/prisma.service";
import type { AuditService } from "../common/audit.service";
import type { AuthUser } from "../auth/auth.types";
import type { AccountingService } from "./accounting.service";
import { submissionId } from "../common/submission-id";
import { money } from "./money";
import { assertBaseCurrency } from "./base-currency";

export function voucherInput(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new BadRequestException("Expected a voucher");
  const value = body as Record<string, unknown>;
  if (Object.keys(value).some(k => !["date", "memo", "lines"].includes(k))) throw new BadRequestException("Unsupported voucher field");
  if (typeof value.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.date) || !Number.isFinite(Date.parse(value.date)) || new Date(value.date).toISOString().slice(0, 10) !== value.date) throw new BadRequestException("A valid voucher date is required");
  if (typeof value.memo !== "string" || !value.memo.trim() || value.memo.length > 500) throw new BadRequestException("Voucher description is required (maximum 500 characters)");
  if (!Array.isArray(value.lines) || value.lines.length < 2 || value.lines.length > 200) throw new BadRequestException("Use between 2 and 200 voucher lines");
  const lines = value.lines.map((raw: unknown) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new BadRequestException("Invalid voucher line");
    const line = raw as Record<string, unknown>;
    if (Object.keys(line).some(k => !["accountId", "debit", "credit", "memo", "partyType", "partyId"].includes(k))) throw new BadRequestException("Unsupported voucher line field");
    if (typeof line.accountId !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(line.accountId)) throw new BadRequestException("Select a voucher account");
    const amount = (v: unknown) => { if (typeof v !== "string" && typeof v !== "number") throw new BadRequestException("Use decimal voucher amounts"); return money(v).toFixed(2); };
    const debit = amount(line.debit), credit = amount(line.credit);
    if ((debit === "0.00") === (credit === "0.00")) throw new BadRequestException("Each line needs either debit or credit");
    if (line.memo !== undefined && (typeof line.memo !== "string" || line.memo.length > 500)) throw new BadRequestException("Line description is too long");
    if (line.partyType !== undefined && !["customer", "supplier"].includes(String(line.partyType))) throw new BadRequestException("Invalid voucher party");
    if (Boolean(line.partyType) !== Boolean(line.partyId) || (line.partyId !== undefined && (typeof line.partyId !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(line.partyId)))) throw new BadRequestException("Select both party type and party account");
    return { accountId: line.accountId, debit, credit, memo: typeof line.memo === "string" ? line.memo.trim() : "", ...(line.partyType ? { partyType: String(line.partyType), partyId: String(line.partyId) } : {}) };
  });
  if (!lines.reduce((n, l) => n.plus(l.debit).minus(l.credit), money(0)).isZero()) throw new BadRequestException("Voucher is not balanced");
  return { date: value.date, memo: value.memo.trim(), lines };
}

export async function postManualVoucher(db: PrismaService, accounting: AccountingService, audit: AuditService, user: AuthUser, body: unknown, key: unknown) {
  const id = submissionId("manual-voucher", [user.id], key).replace(":", "_");
  const input = voucherInput(body);
  const hash = createHash("sha256").update(JSON.stringify({ ...input, branchId: user.defaultBranchId ?? null })).digest("hex");
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${id}))`;
    const saved = await tx.journalEntry.findUnique({ where: { id }, include: { lines: true } });
    if (saved) {
      const proof = await tx.auditLog.findUnique({ where: { id } });
      if ((proof?.after as { requestHash?: string } | null)?.requestHash !== hash) throw new ConflictException("Voucher submission changed or requires review. Do not post it again.");
      return saved;
    }
    for (const line of input.lines) {
      const account = await tx.chartOfAccount.findUnique({ where: { id: line.accountId } });
      if (!account) throw new NotFoundException("Voucher account unavailable");
      if ((account.code === "1300" && line.partyType !== "customer") || (account.code === "2100" && line.partyType !== "supplier")) throw new BadRequestException("Receivable and payable lines require the matching customer or supplier");
      if (line.partyType === "customer") {
        const customer = await tx.customer.findUnique({ where: { id: line.partyId } });
        if (!customer || customer.deletedAt || (user.defaultBranchId && customer.branchId !== user.defaultBranchId)) throw new NotFoundException("Voucher customer unavailable in the voucher branch");
        if (customer.leadId && user.defaultBranchId) {
          const lead = await tx.lead.findUnique({ where: { id: customer.leadId } });
          if (!lead || lead.branchId !== user.defaultBranchId) throw new NotFoundException("Voucher customer unavailable in the voucher branch");
        }
      }
      if (line.partyType === "supplier") {
        const supplier = await tx.supplier.findUnique({ where: { id: line.partyId } });
        if (!supplier || supplier.deletedAt || supplier.status !== "ACTIVE") throw new NotFoundException("Voucher supplier unavailable");
      }
    }
    await assertBaseCurrency(tx, { currency: "PKR" });
    const journal = await accounting.postJournal({ id, db: tx, date: new Date(input.date), memo: input.memo, lines: input.lines, userId: user.id, branchId: user.defaultBranchId, kind: "MANUAL", module: "accounts" });
    await audit.log({ id, db: tx, userId: user.id, action: "SUBMIT_VOUCHER", entity: "journalEntry", entityId: journal.id, after: { requestHash: hash } });
    return journal;
  });
}
