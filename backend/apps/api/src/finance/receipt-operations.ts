import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma, type UmrahBooking, type TicketSale, type HotelBooking, type TransportBooking, type StarBooking } from "@prisma/client";
import type { AuthUser } from "../auth/auth.types";
import type { PrismaService } from "../common/prisma.service";
import type { SequenceService } from "../common/sequence.service";
import type { AuditService } from "../common/audit.service";
import type { AccountingService } from "./accounting.service";

export const RECEIPT_SOURCES = ["bookingId", "ticketSaleId", "hotelBookingId", "transportBookingId", "starBookingId"] as const;
export type ReceiptSource = typeof RECEIPT_SOURCES[number];
type SourceRows = { bookingId: UmrahBooking; ticketSaleId: TicketSale; hotelBookingId: HotelBooking; transportBookingId: TransportBooking; starBookingId: StarBooking };
export type ReceiptInput = Partial<Record<ReceiptSource, string>> & { customerId?: string; branchId?: string; amount: number; method: string; notes?: string };

export function receiptSubmissionId(userId: string, key: unknown) {
  if (typeof key !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(key)) throw new BadRequestException("A valid Idempotency-Key is required for receipts");
  return `request_${createHash("sha256").update(`${userId}:${key}`).digest("hex")}`;
}

function paymentAmount(input: unknown) {
  const amount = Number(input);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12 || new Prisma.Decimal(amount).decimalPlaces() > 2) throw new BadRequestException("Receipt amount must be positive with at most two decimal places");
  return amount;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}

function financeAuthority(user: AuthUser) {
  // Matches the existing GlobalFinanceGuard. Creating a booking does not grant finance authority.
  if (!user.isSuperAdmin) throw new ForbiddenException("Finance authorization is required to record payments");
}

function requireReceiptWrites() {
  const disabled = process.env.RECEIPT_WRITES_DISABLED;
  if (disabled && disabled !== "false") throw new ServiceUnavailableException("Receipt writes are temporarily disabled");
}

export class ReceiptOperations {
  constructor(private prisma: PrismaService, private seq: SequenceService, private audit: AuditService, private accounting: AccountingService) {}

  private async lockScope(tx: Prisma.TransactionClient, customerId?: string | null, branchId?: string | null) {
    const scope = customerId ? `customer:${customerId}` : `unallocated:${branchId || "global"}`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${scope}, 1))::text`;
  }

  private sourceField(body: Partial<Record<ReceiptSource, string | null>>) {
    const selected = RECEIPT_SOURCES.filter(field => body[field]);
    if (selected.length > 1) throw new BadRequestException("A receipt may target only one booking");
    for (const field of selected) if (typeof body[field] !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(body[field]!)) throw new BadRequestException("Invalid receipt booking reference");
    return selected[0];
  }

  private async source(tx: Prisma.TransactionClient, field: ReceiptSource, id: string) {
    const table = { bookingId: "UmrahBooking", ticketSaleId: "TicketSale", hotelBookingId: "HotelBooking", transportBookingId: "TransportBooking", starBookingId: "StarBooking" }[field];
    // Identifiers come only from the fixed server map; request identifiers remain bound parameters.
    await tx.$queryRaw(Prisma.sql`SELECT id FROM ${Prisma.raw(`"${table}"`)} WHERE id = ${id} FOR UPDATE`);
    if (field === "bookingId") {
      const row = await tx.umrahBooking.findUnique({ where: { id } });
      if (!row) throw new NotFoundException("Booking not found");
      return { id, customerId: row.customerId, branchId: row.branchId, net: row.net, paid: row.paid, module: "umrah", closed: row.status === "CANCELLED",
        read: () => tx.umrahBooking.findUniqueOrThrow({ where: { id } }),
        apply: (paid: Prisma.Decimal) => tx.umrahBooking.update({ where: { id }, data: { paid, balance: row.net.minus(paid), status: row.status === "DRAFT" ? "CONFIRMED" : row.status, workflowStep: ["LEAD", "QUOTATION", "CUSTOMER_CONFIRMATION"].includes(row.workflowStep) ? "ADVANCE_PAYMENT" : row.workflowStep } }) };
    }
    if (field === "ticketSaleId") {
      const row = await tx.ticketSale.findUnique({ where: { id }, include: { refunds: true } });
      if (!row) throw new NotFoundException("Ticket not found");
      return { id, customerId: row.customerId, branchId: row.branchId, net: row.net, paid: row.paidAmount, module: "ticket", closed: ["CANCELLED", "REISSUED", "REFUNDED"].includes(row.status) || row.refunds.length > 0,
        read: () => tx.ticketSale.findUniqueOrThrow({ where: { id } }),
        apply: (paid: Prisma.Decimal) => tx.ticketSale.update({ where: { id }, data: { paidAmount: paid, paymentStatus: paid.equals(row.net) ? "PAID" : "PARTIAL" } }) };
    }
    if (field === "hotelBookingId") {
      const row = await tx.hotelBooking.findUnique({ where: { id } });
      if (!row) throw new NotFoundException("Reservation not found");
      return { id, customerId: row.customerId, branchId: row.branchId, net: row.net, paid: row.paid, module: "reservation", closed: !!row.cancelledAt || row.status === "CANCELLED",
        read: () => tx.hotelBooking.findUniqueOrThrow({ where: { id } }),
        apply: (paid: Prisma.Decimal) => tx.hotelBooking.update({ where: { id }, data: { paid, balance: row.net.minus(paid) } }) };
    }
    if (field === "transportBookingId") {
      const row = await tx.transportBooking.findUnique({ where: { id } });
      if (!row) throw new NotFoundException("Transport booking not found");
      return { id, customerId: row.customerId, branchId: row.branchId, net: row.sellingPrice, paid: row.paid, module: "transport", closed: ["CANCELLED", "CANCELED"].includes(row.status.toUpperCase()),
        read: () => tx.transportBooking.findUniqueOrThrow({ where: { id } }),
        apply: (paid: Prisma.Decimal) => tx.transportBooking.update({ where: { id }, data: { paid, paymentStatus: paid.equals(row.sellingPrice) ? "PAID" : "PARTIAL" } }) };
    }
    const row = await tx.starBooking.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("STAR booking not found");
    return { id, customerId: row.customerId, branchId: row.branchId, net: row.sellingPrice, paid: row.paid, module: "star", closed: ["CANCELLED", "CANCELED"].includes(row.status.toUpperCase()),
      read: () => tx.starBooking.findUniqueOrThrow({ where: { id } }),
      apply: (paid: Prisma.Decimal) => tx.starBooking.update({ where: { id }, data: { paid, paymentStatus: paid.equals(row.sellingPrice) ? "PAID" : "PARTIAL" } }) };
  }

  async create(body: ReceiptInput, user: AuthUser, key?: string) {
    financeAuthority(user);
    requireReceiptWrites();
    return this.prisma.$transaction(tx => this.createInTransaction(tx, body, user, key), { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  private async createInTransaction(tx: Prisma.TransactionClient, body: ReceiptInput, user: AuthUser, key?: string, fingerprint?: string) {
    const amount = paymentAmount(body.amount);
    if (!["CASH", "BANK", "CARD", "ONLINE"].includes(body.method)) throw new BadRequestException("Invalid receipt method");
    if (body.notes !== undefined && (typeof body.notes !== "string" || body.notes.length > 4000)) throw new BadRequestException("Invalid receipt notes");
    const id = receiptSubmissionId(user.id, key);
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))::text`;
    const field = this.sourceField(body);
    const source = field ? await this.source(tx, field, body[field]!) : undefined;
    if (source && ((body.customerId && body.customerId !== source.customerId) || (body.branchId && body.branchId !== source.branchId))) throw new BadRequestException("Receipt party or branch does not match the booking");
    const customerId = source ? source.customerId : body.customerId;
    const branchId = source ? source.branchId : body.branchId || user.defaultBranchId;
    await this.lockScope(tx, customerId, branchId);
    const existing = await tx.receipt.findUnique({ where: { id } });
    if (existing) {
      if (RECEIPT_SOURCES.some(name => (existing[name] || null) !== (body[name] || null)) || existing.customerId !== (customerId || null) || existing.branchId !== (branchId || null) || !existing.amount.equals(amount) || existing.method !== body.method || existing.notes !== (body.notes ?? null) || (fingerprint && existing.submissionFingerprint !== fingerprint)) throw new ConflictException("Idempotency key was already used for another receipt");
      return existing;
    }
    const scope = customerId ? Prisma.sql`r."customerId" = ${customerId}` : Prisma.sql`r."customerId" IS NULL AND r."branchId" IS NOT DISTINCT FROM ${branchId || null}`;
    const pending = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT r.id FROM "Receipt" r WHERE ${scope} AND left(r.id, 8) = 'request_' AND NOT EXISTS (SELECT 1 FROM "AuditLog" a WHERE a.action = 'REVIEW_RECEIPT' AND a.entity = 'Receipt' AND a."entityId" = r.id) LIMIT 1`);
    if (pending.length) throw new ConflictException(`Review saved receipt ${pending[0].id} before starting another payment`);
    if (source) {
      if (source.closed || source.net.minus(source.paid).lessThan(amount)) throw new BadRequestException("Receipt exceeds outstanding balance or booking requires review");
      const allocated = await tx.receipt.aggregate({ where: { [field!]: source.id }, _sum: { amount: true } });
      if (!source.paid.equals(allocated._sum.amount ?? 0)) throw new ConflictException("Legacy paid totals require accounting review before adding receipts");
    }
    const journal = await this.accounting.postReceipt({ db: tx, userId: user.id, amount, method: body.method, customerId, branchId, sourceId: source?.id, module: source?.module ?? "accounts" });
    const receiptNo = await this.seq.next("rec", "ZAT-REC", tx);
    const links = Object.fromEntries(RECEIPT_SOURCES.map(name => [name, body[name] || null]));
    const receipt = await tx.receipt.create({ data: { ...links, id, receiptNo, customerId, branchId, amount, method: body.method, notes: body.notes, journalId: journal.id, submissionFingerprint: fingerprint } });
    if (source) await source.apply(source.paid.plus(amount));
    await this.audit.log({ db: tx, userId: user.id, action: "CREATE", entity: "Receipt", entityId: receipt.id });
    return receipt;
  }

  async initial<F extends ReceiptSource>(user: AuthUser, body: Record<string, unknown>, key: string | undefined, field: F, amountInput: unknown, create: (tx: Prisma.TransactionClient) => Promise<SourceRows[F]>): Promise<SourceRows[F]> {
    const amount = Number(amountInput ?? 0);
    if (amount === 0) return this.prisma.$transaction(create, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    requireReceiptWrites();
    paymentAmount(amountInput);
    financeAuthority(user);
    if (!["CASH", "BANK"].includes(String(body.paymentMethod))) throw new BadRequestException("Choose an explicit CASH or BANK method for the initial receipt");
    const id = receiptSubmissionId(user.id, key);
    const fingerprint = createHash("sha256").update(JSON.stringify(canonical({ source: field, payload: body }))).digest("hex");
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))::text`;
      const existing = await tx.receipt.findUnique({ where: { id } });
      if (existing) {
        if (existing.submissionFingerprint !== fingerprint || !existing[field]) throw new ConflictException("Initial payment key was already used for another submission");
        return (await this.source(tx, field, existing[field]!)).read() as unknown as Promise<SourceRows[F]>;
      }
      const booking = await create(tx);
      await this.createInTransaction(tx, { [field]: booking.id, amount, method: String(body.paymentMethod) }, user, key, fingerprint);
      return (await this.source(tx, field, booking.id)).read() as unknown as Promise<SourceRows[F]>;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10000, timeout: 30000 });
  }

  async review(id: string, acknowledged: boolean, user: AuthUser) {
    financeAuthority(user);
    requireReceiptWrites();
    if (acknowledged !== true) throw new BadRequestException("Review the saved receipt before starting another payment");
    return this.prisma.$transaction(async tx => {
      const receipt = await tx.receipt.findUnique({ where: { id } });
      if (!receipt) throw new NotFoundException();
      const field = this.sourceField(receipt);
      if (field) await this.source(tx, field, receipt[field]!);
      await this.lockScope(tx, receipt.customerId, receipt.branchId);
      if (!await tx.auditLog.findFirst({ where: { action: "REVIEW_RECEIPT", entity: "Receipt", entityId: id } })) await this.audit.log({ db: tx, userId: user.id, action: "REVIEW_RECEIPT", entity: "Receipt", entityId: id });
      return { ok: true };
    });
  }
}
