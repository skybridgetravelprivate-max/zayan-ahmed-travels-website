import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { AuthUser } from "../auth/auth.types";
import type { PrismaService } from "../common/prisma.service";
import type { SequenceService } from "../common/sequence.service";
import type { AuditService } from "../common/audit.service";
import type { AccountingService } from "./accounting.service";
import { money, paymentMethod, type MoneyInput } from "./money";

export type PaymentInput = { supplierId?: string; branchId?: string; amount: MoneyInput; method: string; notes?: string };
export function paymentSubmissionId(userId: string, key: unknown) {
  if (typeof key !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(key)) throw new BadRequestException("A valid Idempotency-Key is required for supplier payments");
  return `payreq_${createHash("sha256").update(`${userId}:${key}`).digest("hex")}`;
}

/** Owns one atomic payment, journal and audit; review is not proof of bank transfer. */
export class PaymentOperations {
  constructor(private prisma: PrismaService, private seq: SequenceService, private audit: AuditService, private accounting: AccountingService) {}
  private authority(user: AuthUser) {
    if (!user.isSuperAdmin) throw new ForbiddenException();
    if (process.env.BUSINESS_WRITES_DISABLED && process.env.BUSINESS_WRITES_DISABLED !== "false") throw new ServiceUnavailableException("Business writes are temporarily disabled");
  }
  private async lock(tx: Prisma.TransactionClient, supplierId: string | null, branchId: string | null) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`supplier-payment:${supplierId || "unallocated"}:${branchId || "global"}`}, 2))::text`;
  }
  async create(body: PaymentInput, user: AuthUser, key?: string) {
    this.authority(user);
    const amount = money(body.amount, true), method = paymentMethod(body.method), id = paymentSubmissionId(user.id, key);
    for (const value of [body.supplierId, body.branchId]) if (value !== undefined && (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(value))) throw new BadRequestException("Invalid supplier or branch");
    if (body.notes !== undefined && (typeof body.notes !== "string" || body.notes.length > 4000)) throw new BadRequestException("Invalid payment notes");
    const supplierId = body.supplierId || null, branchId = body.branchId || user.defaultBranchId || null;
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))::text`;
      await this.lock(tx, supplierId, branchId);
      const saved = await tx.payment.findUnique({ where: { id } });
      if (saved) {
        if (!saved.amount.equals(amount) || saved.method !== method || saved.supplierId !== supplierId || saved.branchId !== branchId || saved.notes !== (body.notes ?? null)) throw new ConflictException("Payment key already used for different details");
        return saved;
      }
      if (supplierId && !await tx.supplier.findFirst({ where: { id: supplierId, deletedAt: null } })) throw new BadRequestException("Supplier unavailable");
      if (branchId && !await tx.branch.findUnique({ where: { id: branchId } })) throw new BadRequestException("Branch unavailable");
      const pending = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT p.id FROM "Payment" p WHERE p."supplierId" IS NOT DISTINCT FROM ${supplierId} AND p."branchId" IS NOT DISTINCT FROM ${branchId} AND left(p.id,7)='payreq_' AND NOT EXISTS (SELECT 1 FROM "AuditLog" a WHERE a.action='REVIEW_PAYMENT' AND a.entity='Payment' AND a."entityId"=p.id) LIMIT 1`);
      if (pending.length) throw new ConflictException("Review the saved supplier payment before starting another submission");
      const journal = await this.accounting.postPayment({ db: tx, userId: user.id, amount, method, supplierId, branchId, sourceId: id, module: "accounts" });
      const paymentNo = await this.seq.next("pay", "ZAT-PAY", tx);
      const payment = await tx.payment.create({ data: { id, paymentNo, supplierId, branchId, amount, method, notes: body.notes, journalId: journal.id } });
      await this.audit.log({ db: tx, userId: user.id, action: "CREATE", entity: "Payment", entityId: id });
      return payment;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
  async pending(user: AuthUser) {
    if (!user.isSuperAdmin) throw new ForbiddenException();
    const rows = await this.prisma.$queryRaw<{ id: string; paymentNo: string; amount: Prisma.Decimal; method: string }[]>`SELECT p.id,p."paymentNo",p.amount,p.method FROM "Payment" p WHERE left(p.id,7)='payreq_' AND NOT EXISTS (SELECT 1 FROM "AuditLog" a WHERE a.action='REVIEW_PAYMENT' AND a.entity='Payment' AND a."entityId"=p.id) ORDER BY p."createdAt",p.id LIMIT 20`;
    return rows;
  }
  async review(id: string, acknowledged: boolean, user: AuthUser) {
    this.authority(user);
    if (acknowledged !== true) throw new BadRequestException("Review the saved payment first");
    return this.prisma.$transaction(async tx => {
      const payment = await tx.payment.findUnique({ where: { id } });
      if (!payment) throw new NotFoundException();
      await this.lock(tx, payment.supplierId, payment.branchId);
      if (!await tx.auditLog.findFirst({ where: { entity: "Payment", entityId: id, action: "REVIEW_PAYMENT" } })) await this.audit.log({ db: tx, userId: user.id, entity: "Payment", entityId: id, action: "REVIEW_PAYMENT" });
      return { ok: true };
    });
  }
}
