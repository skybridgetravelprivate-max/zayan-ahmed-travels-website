import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { AccountingService } from "../finance/accounting.service";
import { AuthUser, can } from "../auth/auth.types";

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private accounting: AccountingService,
  ) {}

  assert(user: AuthUser, perm: string) {
    if (!can(user, perm)) throw new ForbiddenException(perm);
  }

  async postUnposted(user: AuthUser) {
    this.assert(user, "admin.post");
    const drafts = await this.prisma.journalEntry.findMany({ where: { status: "DRAFT" } });
    let count = 0;
    for (const j of drafts) {
      await this.prisma.journalEntry.update({ where: { id: j.id }, data: { status: "POSTED" } });
      count += 1;
    }
    await this.audit.log({ userId: user.id, action: "post", entity: "JournalEntry", after: { count } });
    return { count };
  }

  async hotelDiscount(user: AuthUser, percent: number) {
    this.assert(user, "admin.discount");
    if (!(percent > 0) || percent > 90) throw new BadRequestException("Invalid percent");
    const rooms = await this.prisma.hotelStayRoom.findMany();
    const factor = 1 - percent / 100;
    for (const r of rooms) {
      const next = Number(r.sellingPrice) * factor;
      await this.prisma.hotelStayRoom.update({
        where: { id: r.id },
        data: { sellingPrice: new Prisma.Decimal(next.toFixed(2)) },
      });
    }
    await this.audit.log({ userId: user.id, action: "discount", entity: "HotelStayRoom", after: { percent, count: rooms.length } });
    return { count: rooms.length, percent };
  }

  async advanceUmrah(user: AuthUser, id: string, status: string, reason: string) {
    this.assert(user, "admin.advance");
    if (!reason) throw new BadRequestException("Reason required");
    const before = await this.prisma.umrahBooking.findUnique({ where: { id } });
    if (!before) throw new BadRequestException("Booking not found");
    const updated = await this.prisma.umrahBooking.update({
      where: { id },
      data: { workflowStep: status },
    });
    await this.audit.log({ userId: user.id, action: "advance", entity: "UmrahBooking", entityId: id, before, after: { status, reason } });
    return updated;
  }

  async deleteRecord(user: AuthUser, kind: string, id: string, confirm: string, reason: string) {
    this.assert(user, "admin.delete");
    if (!user.isSuperAdmin) throw new ForbiddenException("Super Admin only");
    if (confirm !== "DELETE") throw new BadRequestException("Type DELETE to confirm");
    if (!reason) throw new BadRequestException("Reason required");
    if (kind === "umrah") await this.prisma.umrahBooking.delete({ where: { id } });
    else if (kind === "hotel") await this.prisma.hotelBooking.delete({ where: { id } });
    else if (kind === "ticket") await this.prisma.ticketSale.delete({ where: { id } });
    else throw new BadRequestException("Unsupported kind");
    await this.audit.log({ userId: user.id, action: "delete", entity: kind, entityId: id, after: { reason } });
    return { ok: true };
  }

  async duplicateMutamers(user: AuthUser) {
    this.assert(user, "passenger.view");
    const people = await this.prisma.passenger.findMany({ where: { deletedAt: null } });
    const byPass = new Map<string, typeof people>();
    const byCnic = new Map<string, typeof people>();
    for (const p of people) {
      const pass = String(p.passportNumber || "").trim().toUpperCase();
      const cnic = String(p.cnic || "").trim();
      if (pass) byPass.set(pass, [...(byPass.get(pass) || []), p]);
      if (cnic) byCnic.set(cnic, [...(byCnic.get(cnic) || []), p]);
    }
    const groups = [...byPass.entries(), ...byCnic.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([key, list]) => ({ key, names: list.map((p) => p.fullName), ids: list.map((p) => p.id) }));
    return { groups };
  }

  async importCustomers(user: AuthUser, rows: Record<string, string>[]) {
    this.assert(user, "admin.import");
    const errors: string[] = [];
    let count = 0;
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i] || {};
      const fullName = String(row.name || row.fullName || "").trim();
      if (!fullName) {
        errors.push(`Row ${i + 1}: name required`);
        continue;
      }
      const n = await this.prisma.customer.count();
      await this.prisma.customer.create({
        data: {
          customerNumber: `CUS-${String(n + 1).padStart(6, "0")}`,
          fullName,
          phone: row.phone || row.mobile || undefined,
          email: row.email || undefined,
          cnic: row.cnic || undefined,
          passportNumber: row.passport || row.passportNumber || undefined,
        },
      });
      count += 1;
    }
    await this.audit.log({ userId: user.id, action: "import", entity: "Customer", after: { count, errors } });
    return { count, errors };
  }
}
