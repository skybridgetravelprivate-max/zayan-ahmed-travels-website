import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { SequenceService } from "../common/sequence.service";
import { AuditService } from "../common/audit.service";
import { AuthUser, assertCan } from "../auth/auth.types";
import { assertBranch, assertPeopleLinks, assertPeopleLinksInBranch, assertRecordBranch, branchWhere } from "../auth/record-scope";
import { AccountingService } from "../finance/accounting.service";
import { assertBookablePackage } from "./package-catalog";

const money = (n: number) => new Prisma.Decimal(Number(n || 0).toFixed(2));

export const UMRAH_LIFECYCLE = [
  "Draft",
  "Inquiry",
  "Quotation",
  "Confirmation",
  "Payment",
  "Booking Confirmed",
  "Visa Processing",
  "Visa Approved",
  "Ticket Confirmed",
  "Hotel Confirmed",
  "Transport Confirmed",
  "Voucher Generated",
  "Travel",
  "Completed",
  "Cancelled",
];

@Injectable()
export class UmrahOpsService {
  constructor(
    private prisma: PrismaService,
    private seq: SequenceService,
    private audit: AuditService,
    private accounting: AccountingService,
  ) {}

  private totals(input: { cost?: number; sellingPrice?: number; discount?: number; tax?: number; commission?: number; paid?: number }) {
    const cost = Number(input.cost || 0);
    const selling = Number(input.sellingPrice || 0);
    const discount = Number(input.discount || 0);
    const tax = Number(input.tax || 0);
    const commission = Number(input.commission || 0);
    const paid = Number(input.paid || 0);
    if (![cost, selling, discount, tax, commission, paid].every(n => Number.isFinite(n) && n >= 0)) throw new BadRequestException("Invalid financial amounts");
    const net = selling - discount + tax;
    if (cost < 0 || net < 0) throw new BadRequestException("Financial totals cannot be negative.");
    if (paid - net > 0.5) throw new BadRequestException("Paid amount exceeds selling total.");
    return { cost, selling, discount, tax, commission, paid, net, profit: net - cost - commission, balance: Math.max(net - paid, 0) };
  }

  async save(user: AuthUser, body: Record<string, unknown>, ip?: string) {
    return this.prisma.$transaction(tx => this.saveWithDb(user, body, tx, ip), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async saveWithDb(user: AuthUser, body: Record<string, unknown>, db: Prisma.TransactionClient, ip?: string) {
    if (!body.id) assertCan(user, "umrah.create");
    const customerId = String(body.customerId || "");
    if (!customerId) throw new BadRequestException("Customer is required.");
    await assertBookablePackage(db, body.packageId);
    await assertPeopleLinks(db, user, body);
    if (body.id) await assertRecordBranch(db, user, "umrahBooking", body.id);
    else {
      assertBranch(user, body.branchId || user.defaultBranchId);
      await assertPeopleLinksInBranch(db, body, body.branchId || user.defaultBranchId);
    }
    const tot = this.totals(body as { cost?: number; sellingPrice?: number; discount?: number; tax?: number; commission?: number; paid?: number });
    const passengers = Array.isArray(body.passengerIds) ? (body.passengerIds as string[]) : [];
    const bookingNumber = body.id ? undefined : await this.seq.next("umr-bk", "UMR", db);
    const data = {
      customerId,
      packageId: (body.packageId as string) || null,
      groupId: (body.groupId as string) || null,
      groupName: (body.groupName as string) || null,
      departureDate: body.departureDate ? new Date(String(body.departureDate)) : null,
      returnDate: body.returnDate ? new Date(String(body.returnDate)) : null,
      cost: money(tot.cost),
      sellingPrice: money(tot.selling),
      discount: money(tot.discount),
      tax: money(tot.tax),
      commission: money(tot.commission),
      net: money(tot.net),
      paid: money(tot.paid),
      balance: money(tot.balance),
      profit: money(tot.profit),
      workflowStep: String(body.workflowStep || "Draft"),
      notes: (body.notes as string) || null,
      iataCode: (body.iataCode as string) || null,
      visaStatus: (body.visaStatus as string) || null,
      hotelBookingId: (body.hotelBookingId as string) || null,
      ticketSaleId: (body.ticketSaleId as string) || null,
      transportId: (body.transportId as string) || null,
    };
    if (data.departureDate && data.returnDate && data.returnDate < data.departureDate) {
      throw new BadRequestException("Return date cannot be before departure.");
    }
    let row;
    if (body.id) {
      assertCan(user, "umrah.edit");
      row = await db.umrahBooking.update({ where: { id: String(body.id) }, data });
    } else {
      assertCan(user, "umrah.create");
      row = await db.umrahBooking.create({
        data: { ...data, branchId: (body.branchId as string) || user.defaultBranchId, bookingNumber: bookingNumber as string, status: "DRAFT" },
      });
    }
    if (passengers.length) {
      await db.umrahBookingPassenger.deleteMany({ where: { bookingId: row.id } });
      await db.umrahBookingPassenger.createMany({
        data: passengers.map((passengerId) => ({ bookingId: row.id, passengerId })),
      });
    }
    if (!body.id) {
      await this.accounting.postSale({
        db,
        userId: user.id,
        module: "umrah",
        sourceId: row.id,
        amount: Number(row.net),
        customerId: row.customerId,
        branchId: row.branchId,
        memo: `Umrah ${row.bookingNumber}`,
      });
      await this.accounting.postCost({
        db,
        userId: user.id,
        module: "umrah",
        sourceId: row.id,
        amount: Number(row.cost),
        branchId: row.branchId,
        memo: `Umrah cost ${row.bookingNumber}`,
      });
    }
    await this.audit.log({ db, userId: user.id, action: body.id ? "update" : "create", entity: "UmrahBooking", entityId: row.id, after: row, ipAddress: ip });
    return db.umrahBooking.findUnique({ where: { id: row.id }, include: { passengers: true, customer: true } });
  }

  async lifecycle(user: AuthUser, id: string, step: string, ip?: string) {
    assertCan(user, "umrah.edit");
    if (!UMRAH_LIFECYCLE.includes(step)) throw new BadRequestException("Unknown lifecycle status.");
    const existing = await this.prisma.umrahBooking.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    assertBranch(user, existing.branchId);
    if (existing.status === "CANCELLED" && step !== "Cancelled") throw new BadRequestException("Cancelled bookings cannot change status.");
    const row = await this.prisma.umrahBooking.update({
      where: { id },
      data: { workflowStep: step, status: step === "Cancelled" ? "CANCELLED" : step === "Completed" ? "COMPLETED" : existing.status },
    });
    await this.audit.log({ userId: user.id, action: "lifecycle", entity: "UmrahBooking", entityId: id, after: row, ipAddress: ip });
    return row;
  }

  async lockIata(user: AuthUser, id: string, iataCode: string, ip?: string) {
    assertCan(user, "umrah.edit");
    const existing = await this.prisma.umrahBooking.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    assertBranch(user, existing.branchId);
    if (existing.iataLocked) throw new BadRequestException("IATA is locked.");
    if (!String(iataCode || "").trim()) throw new BadRequestException("IATA code is required.");
    const row = await this.prisma.umrahBooking.update({
      where: { id },
      data: { iataCode: iataCode.trim().toUpperCase(), iataLocked: true },
    });
    await this.audit.log({ userId: user.id, action: "iata", entity: "UmrahBooking", entityId: id, after: row, ipAddress: ip });
    return row;
  }

  async dashboards(user: AuthUser) {
    assertCan(user, "umrah.view");
    const rows = await this.prisma.umrahBooking.findMany({ where: branchWhere(user), include: { passengers: true } });
    return {
      total: rows.length,
      pax: rows.reduce((n, r) => n + r.passengers.length, 0),
      sales: rows.reduce((n, r) => n + Number(r.net), 0),
      cost: rows.reduce((n, r) => n + Number(r.cost), 0),
      outstanding: rows.reduce((n, r) => n + Number(r.balance), 0),
    };
  }
}
