import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { SequenceService } from "../common/sequence.service";
import { AuditService } from "../common/audit.service";
import { NotifyService } from "../common/notify.service";
import { AuthUser } from "../auth/auth.types";

const TERMINAL = new Set(["Closed", "Cancelled"]);

type ComplaintBody = {
  customerId?: string;
  passengerId?: string;
  assignedUserId?: string;
  module?: string;
  category?: string;
  priority?: string;
  subject?: string;
  description?: string;
  resolution?: string;
  notes?: string;
  bookingRef?: string;
  bookingId?: string;
  status?: string;
};

@Injectable()
export class ComplaintsService {
  constructor(
    private prisma: PrismaService,
    private seq: SequenceService,
    private audit: AuditService,
    private notify: NotifyService,
  ) {}

  private include() {
    return {
      customer: { select: { id: true, fullName: true, customerNumber: true } },
      passenger: { select: { id: true, fullName: true, passportNumber: true } },
      assignedUser: { select: { id: true, fullName: true, email: true } },
      createdBy: { select: { id: true, fullName: true } },
      events: { orderBy: { createdAt: "desc" as const }, take: 50 },
    };
  }

  async list(query: Record<string, string>) {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.module) where.module = query.module;
    if (query.category) where.category = query.category;
    if (query.priority) where.priority = query.priority;
    if (query.customerId) where.customerId = query.customerId;
    if (query.assignedUserId) where.assignedUserId = query.assignedUserId;
    if (query.q) {
      where.OR = [
        { complaintNumber: { contains: query.q, mode: "insensitive" } },
        { subject: { contains: query.q, mode: "insensitive" } },
        { description: { contains: query.q, mode: "insensitive" } },
        { bookingRef: { contains: query.q, mode: "insensitive" } },
        { customer: { fullName: { contains: query.q, mode: "insensitive" } } },
      ];
    }
    return this.prisma.complaint.findMany({
      where,
      include: this.include(),
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async get(id: string) {
    const row = await this.prisma.complaint.findUnique({
      where: { id },
      include: {
        ...this.include(),
      },
    });
    if (!row) throw new NotFoundException("Complaint not found");
    const documents = await this.prisma.storedDocument.findMany({
      where: { entityType: "complaint", entityId: id },
      orderBy: { createdAt: "desc" },
    });
    return { ...row, documents };
  }

  async create(user: AuthUser, body: ComplaintBody | Record<string, unknown>, ip?: string) {
    const b = body as ComplaintBody;
    if (!b.customerId) throw new BadRequestException("Customer is required.");
    if (!String(b.description || "").trim()) throw new BadRequestException("Description is required.");
    const complaintNumber = await this.seq.next("cmp", "CMP");
    const row = await this.prisma.complaint.create({
      data: {
        complaintNumber,
        customerId: b.customerId,
        passengerId: b.passengerId || null,
        assignedUserId: b.assignedUserId || null,
        createdById: user.id,
        branchId: user.defaultBranchId || null,
        module: b.module || "GENERAL",
        category: b.category || "Other",
        priority: b.priority || "Medium",
        status: b.assignedUserId ? "Assigned" : "Open",
        subject: b.subject || null,
        description: String(b.description).trim(),
        resolution: b.resolution || null,
        notes: b.notes || null,
        bookingRef: b.bookingRef || null,
        bookingId: b.bookingId || null,
        assignedAt: b.assignedUserId ? new Date() : null,
        events: {
          create: { userId: user.id, action: "create", body: b.assignedUserId ? "Assigned on create" : "Opened" },
        },
      },
      include: this.include(),
    });
    await this.audit.log({
      userId: user.id,
      action: "complaint.create",
      entity: "complaint",
      entityId: row.id,
      after: { complaintNumber, status: row.status },
      ipAddress: ip,
    });
    if (row.assignedUserId) {
      await this.notify.send(row.assignedUserId, "Complaint assigned", `${row.complaintNumber} was assigned to you.`, "INFO", {
        complaintId: row.id,
      });
    }
    return row;
  }

  async update(user: AuthUser, id: string, body: ComplaintBody | Record<string, unknown>, ip?: string) {
    const existing = await this.prisma.complaint.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Complaint not found");
    if (TERMINAL.has(existing.status)) throw new BadRequestException("Closed or cancelled complaints cannot be edited.");
    const data: Record<string, unknown> = {};
    const keys: (keyof ComplaintBody)[] = [
      "passengerId",
      "module",
      "category",
      "priority",
      "subject",
      "description",
      "resolution",
      "notes",
      "bookingRef",
      "bookingId",
    ];
    for (const k of keys) {
      if (body[k] !== undefined) data[k] = body[k] || null;
    }
    const row = await this.prisma.complaint.update({
      where: { id },
      data: {
        ...data,
        events: { create: { userId: user.id, action: "edit", body: "Fields updated" } },
      },
      include: this.include(),
    });
    await this.audit.log({
      userId: user.id,
      action: "complaint.update",
      entity: "complaint",
      entityId: id,
      before: { status: existing.status },
      after: data,
      ipAddress: ip,
    });
    return row;
  }

  async assign(user: AuthUser, id: string, assignedUserId: string, ip?: string) {
    const existing = await this.prisma.complaint.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Complaint not found");
    if (TERMINAL.has(existing.status) || existing.status === "Resolved") {
      throw new BadRequestException("Cannot assign this complaint.");
    }
    if (!assignedUserId) throw new BadRequestException("Assigned user is required.");
    const row = await this.prisma.complaint.update({
      where: { id },
      data: {
        assignedUserId,
        status: "Assigned",
        assignedAt: new Date(),
        events: { create: { userId: user.id, action: "assign", body: assignedUserId } },
      },
      include: this.include(),
    });
    await this.audit.log({
      userId: user.id,
      action: "complaint.assign",
      entity: "complaint",
      entityId: id,
      after: { assignedUserId },
      ipAddress: ip,
    });
    await this.notify.send(assignedUserId, "Complaint assigned", `${row.complaintNumber} was assigned to you.`, "INFO", {
      complaintId: row.id,
    });
    return row;
  }

  async resolve(user: AuthUser, id: string, resolution: string, ip?: string) {
    const existing = await this.prisma.complaint.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Complaint not found");
    if (TERMINAL.has(existing.status)) throw new BadRequestException("Cannot resolve this complaint.");
    if (!String(resolution || existing.resolution || "").trim()) {
      throw new BadRequestException("Resolution is required.");
    }
    const row = await this.prisma.complaint.update({
      where: { id },
      data: {
        resolution: resolution || existing.resolution,
        status: "Resolved",
        resolvedAt: new Date(),
        events: { create: { userId: user.id, action: "resolve", body: resolution } },
      },
      include: this.include(),
    });
    await this.audit.log({
      userId: user.id,
      action: "complaint.resolve",
      entity: "complaint",
      entityId: id,
      ipAddress: ip,
    });
    return row;
  }

  async close(user: AuthUser, id: string, ip?: string) {
    const existing = await this.prisma.complaint.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Complaint not found");
    if (existing.status !== "Resolved") throw new BadRequestException("Close is only allowed after Resolved.");
    const row = await this.prisma.complaint.update({
      where: { id },
      data: {
        status: "Closed",
        closedAt: new Date(),
        events: { create: { userId: user.id, action: "close", body: "Closed" } },
      },
      include: this.include(),
    });
    await this.audit.log({
      userId: user.id,
      action: "complaint.close",
      entity: "complaint",
      entityId: id,
      ipAddress: ip,
    });
    return row;
  }

  async addNote(user: AuthUser, id: string, body: string, ip?: string) {
    const existing = await this.prisma.complaint.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Complaint not found");
    if (!String(body || "").trim()) throw new BadRequestException("Note is required.");
    const notes = [existing.notes, `${new Date().toISOString()} ${user.email}: ${body.trim()}`].filter(Boolean).join("\n");
    const row = await this.prisma.complaint.update({
      where: { id },
      data: {
        notes,
        events: { create: { userId: user.id, action: "note", body } },
      },
      include: this.include(),
    });
    await this.audit.log({
      userId: user.id,
      action: "complaint.note",
      entity: "complaint",
      entityId: id,
      ipAddress: ip,
    });
    return row;
  }

  async remove(user: AuthUser, id: string, ip?: string) {
    const existing = await this.prisma.complaint.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Complaint not found");
    await this.prisma.complaint.delete({ where: { id } });
    await this.audit.log({
      userId: user.id,
      action: "complaint.delete",
      entity: "complaint",
      entityId: id,
      before: { complaintNumber: existing.complaintNumber },
      ipAddress: ip,
    });
    return { ok: true };
  }
}
