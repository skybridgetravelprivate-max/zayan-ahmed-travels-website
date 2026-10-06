import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { SequenceService } from "../common/sequence.service";
import { AuditService } from "../common/audit.service";
import { NotifyService } from "../common/notify.service";
import { MailService } from "../common/mail.service";
import { WhatsAppService } from "../common/whatsapp.service";
import { AuthUser } from "../auth/auth.types";
import { LeadStatus } from "@prisma/client";

const STATUSES: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "FOLLOW_UP",
  "INTERESTED",
  "QUOTED",
  "NEGOTIATION",
  "CONFIRMED",
  "LOST",
  "CANCELLED",
];

@Injectable()
export class CrmService {
  constructor(
    private prisma: PrismaService,
    private seq: SequenceService,
    private audit: AuditService,
    private notify: NotifyService,
    private mail: MailService,
    private wa: WhatsAppService,
  ) {}

  async pipeline(
    user: AuthUser,
    filters: { q?: string; source?: string; priority?: string; assignedUserId?: string; archived?: string } = {},
  ) {
    const branch =
      !user.isSuperAdmin && user.branchIds.length ? { branchId: { in: user.branchIds } } : {};
    const where: Record<string, unknown> = {
      ...branch,
      archivedAt: filters.archived === "1" ? { not: null } : null,
    };
    if (filters.source) where.source = filters.source;
    if (filters.priority) where.priority = filters.priority;
    if (filters.assignedUserId) where.assignedUserId = filters.assignedUserId;
    if (filters.q) {
      where.OR = [
        { fullName: { contains: filters.q, mode: "insensitive" } },
        { mobile: { contains: filters.q, mode: "insensitive" } },
        { email: { contains: filters.q, mode: "insensitive" } },
        { cnic: { contains: filters.q, mode: "insensitive" } },
        { leadNumber: { contains: filters.q, mode: "insensitive" } },
      ];
    }
    const groups = await this.prisma.lead.groupBy({
      by: ["status"],
      where,
      _count: true,
    });
    const columns = STATUSES.map((status) => ({
      status,
      count: groups.find((g) => g.status === status)?._count ?? 0,
    }));
    const leads = await this.prisma.lead.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 400,
      select: {
        id: true,
        leadNumber: true,
        fullName: true,
        mobile: true,
        city: true,
        source: true,
        status: true,
        priority: true,
        nextFollowUpAt: true,
        budget: true,
        assignedUserId: true,
        lostReason: true,
        assignedUser: { select: { id: true, fullName: true } },
      },
    });
    return { columns, leads };
  }

  async stats(user: AuthUser) {
    const branch =
      !user.isSuperAdmin && user.branchIds.length ? { branchId: { in: user.branchIds } } : {};
    const [open, overdue, quoted, confirmed, bySource] = await Promise.all([
      this.prisma.lead.count({ where: { archivedAt: null, status: { notIn: ["LOST", "CANCELLED", "CONFIRMED"] }, ...branch } }),
      this.prisma.followUp.count({
        where: { status: "PENDING", dueAt: { lt: new Date() } },
      }),
      this.prisma.lead.count({ where: { status: "QUOTED", archivedAt: null, ...branch } }),
      this.prisma.lead.count({ where: { status: "CONFIRMED", archivedAt: null, ...branch } }),
      this.prisma.lead.groupBy({ by: ["source"], where: { archivedAt: null, ...branch }, _count: true }),
    ]);
    return { open, overdueFollowUps: overdue, quoted, confirmed, bySource };
  }

  async duplicates(mobile?: string, email?: string, cnic?: string, excludeId?: string) {
    const or = [];
    if (mobile) or.push({ mobile });
    if (email) or.push({ email });
    if (cnic) or.push({ cnic });
    if (!or.length) return [];
    return this.prisma.lead.findMany({
      where: {
        OR: or,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, leadNumber: true, fullName: true, mobile: true, email: true, status: true },
      take: 10,
    });
  }

  async customerDuplicates(phone?: string, email?: string, cnic?: string, passport?: string, excludeId?: string) {
    const or = [];
    if (phone) or.push({ phone }, { whatsapp: phone });
    if (email) or.push({ email });
    if (cnic) or.push({ cnic });
    if (passport) or.push({ passportNumber: passport });
    if (!or.length) return [];
    const customers = await this.prisma.customer.findMany({
      where: {
        OR: or,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, customerNumber: true, fullName: true, phone: true, email: true, passportNumber: true, cnic: true },
      take: 10,
    });
    const pax = await this.prisma.passenger.findMany({
      where: {
        OR: [
          ...(phone ? [{ mobile: phone }, { whatsapp: phone }] : []),
          ...(cnic ? [{ cnic }] : []),
          ...(passport ? [{ passportNumber: passport }] : []),
        ],
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, fullName: true, passportNumber: true, cnic: true, customerId: true },
      take: 10,
    });
    return { customers, passengers: pax };
  }

  async updateLead(id: string, user: AuthUser, body: Record<string, unknown>) {
    const allowed = [
      "fullName",
      "fatherName",
      "mobile",
      "whatsapp",
      "email",
      "city",
      "country",
      "cnic",
      "passport",
      "source",
      "priority",
      "adults",
      "children",
      "infants",
      "travelDate",
      "returnDate",
      "budget",
      "hotelPreference",
      "roomType",
      "visaRequired",
      "transportRequired",
      "notes",
      "lostReason",
      "packageId",
    ];
    const data: Record<string, unknown> = {};
    for (const k of allowed) {
      if (body[k] === undefined) continue;
      if (body[k] === "") data[k] = null;
      else if (["travelDate", "returnDate"].includes(k) && typeof body[k] === "string") data[k] = new Date(body[k] as string);
      else if (["adults", "children", "infants", "budget"].includes(k)) data[k] = Number(body[k]);
      else if (["visaRequired", "transportRequired"].includes(k)) data[k] = Boolean(body[k]);
      else data[k] = body[k];
    }
    const lead = await this.prisma.lead.update({ where: { id }, data: data as never });
    await this.audit.log({ userId: user.id, action: "UPDATE", entity: "lead", entityId: id, after: data });
    return lead;
  }

  async workspace(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        assignedUser: { select: { id: true, fullName: true, email: true } },
        assignedAgent: true,
        branch: true,
        package: true,
        followUps: { orderBy: { dueAt: "desc" } },
        tasks: { orderBy: { createdAt: "desc" } },
        quotations: { orderBy: { createdAt: "desc" } },
        customers: true,
        leadNotes: { orderBy: { createdAt: "desc" }, include: { user: { select: { fullName: true } } } },
        communications: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!lead) throw new NotFoundException("Lead not found");
    const documents = await this.prisma.storedDocument.findMany({
      where: { entityType: "lead", entityId: id },
      orderBy: { createdAt: "desc" },
    });
    const bookings = await this.prisma.umrahBooking.findMany({
      where: { customer: { leadId: id } },
      orderBy: { createdAt: "desc" },
    });
    const receipts = await this.prisma.receipt.findMany({
      where: { customer: { leadId: id } },
      orderBy: { date: "desc" },
    });
    const timeline = [
      ...lead.leadNotes.map((n) => ({
        kind: "NOTE",
        at: n.createdAt,
        title: n.user?.fullName ?? "Note",
        body: n.body,
      })),
      ...lead.communications.map((c) => ({
        kind: c.channel,
        at: c.createdAt,
        title: c.subject ?? c.channel,
        body: c.body,
      })),
      ...lead.followUps.map((f) => ({
        kind: "FOLLOW_UP",
        at: f.createdAt,
        title: f.subject,
        body: `${f.type} · ${f.status}`,
      })),
    ].sort((a, b) => +new Date(b.at) - +new Date(a.at));
    return { lead, timeline, documents, bookings, receipts };
  }

  async addNote(id: string, user: AuthUser, body: string) {
    if (!body?.trim()) throw new BadRequestException("Note required");
    const note = await this.prisma.leadNote.create({ data: { leadId: id, userId: user.id, body: body.trim() } });
    await this.audit.log({ userId: user.id, action: "NOTE", entity: "lead", entityId: id, after: note });
    return note;
  }

  async assign(id: string, user: AuthUser, assignedUserId?: string, assignedAgentId?: string) {
    const before = await this.prisma.lead.findUnique({ where: { id } });
    if (!before) throw new NotFoundException();
    const lead = await this.prisma.lead.update({
      where: { id },
      data: {
        assignedUserId: assignedUserId || null,
        assignedAgentId: assignedAgentId || null,
      },
    });
    if (assignedUserId) {
      await this.notify.send(assignedUserId, "Lead assigned", `${lead.fullName} (${lead.leadNumber}) was assigned to you`, "LEAD", {
        leadId: id,
      });
    }
    await this.audit.log({ userId: user.id, action: "ASSIGN", entity: "lead", entityId: id, before, after: lead });
    return lead;
  }

  async setStatus(id: string, user: AuthUser, status: LeadStatus, lostReason?: string) {
    if (!STATUSES.includes(status)) throw new BadRequestException("Invalid status");
    if ((status === "LOST" || status === "CANCELLED") && !lostReason?.trim()) {
      throw new BadRequestException("Reason required for lost/cancelled");
    }
    const lead = await this.prisma.lead.update({
      where: { id },
      data: {
        status,
        lostReason: status === "LOST" || status === "CANCELLED" ? lostReason : null,
      },
    });
    await this.prisma.leadNote.create({
      data: { leadId: id, userId: user.id, body: `Status changed to ${status}${lostReason ? `: ${lostReason}` : ""}` },
    });
    await this.audit.log({ userId: user.id, action: "STATUS", entity: "lead", entityId: id, after: { status, lostReason } });
    return lead;
  }

  async addFollowUp(
    id: string,
    user: AuthUser,
    body: { dueAt: string; type?: string; subject: string; notes?: string; priority?: string },
  ) {
    const follow = await this.prisma.followUp.create({
      data: {
        leadId: id,
        assignedUserId: user.id,
        dueAt: new Date(body.dueAt),
        type: (body.type as never) ?? "CALL",
        subject: body.subject,
        notes: body.notes,
        priority: (body.priority as never) ?? "MEDIUM",
      },
    });
    await this.prisma.lead.update({
      where: { id },
      data: { nextFollowUpAt: follow.dueAt, status: "FOLLOW_UP" },
    });
    return follow;
  }

  async addTask(id: string, user: AuthUser, body: { title: string; description?: string; dueDate?: string }) {
    return this.prisma.task.create({
      data: {
        title: body.title,
        description: body.description,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        leadId: id,
        assignedUserId: user.id,
      },
    });
  }

  async logCommunication(
    id: string,
    user: AuthUser,
    body: { channel: string; subject?: string; message: string; send?: boolean },
  ) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException();
    let delivery: unknown = null;
    if (body.send && body.channel === "EMAIL" && lead.email) {
      delivery = await this.mail.send(lead.email, body.subject ?? "Message", `<p>${body.message}</p>`);
    }
    if (body.send && body.channel === "WHATSAPP" && (lead.whatsapp || lead.mobile)) {
      delivery = await this.wa.send(lead.whatsapp || lead.mobile, body.message);
    }
    const row = await this.prisma.communication.create({
      data: {
        channel: body.channel,
        subject: body.subject,
        body: body.message,
        leadId: id,
        userId: user.id,
      },
    });
    await this.prisma.lead.update({
      where: { id },
      data: { status: lead.status === "NEW" ? "CONTACTED" : lead.status },
    });
    return { communication: row, delivery };
  }

  async quoteFromLead(id: string, user: AuthUser) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException();
    let customerId = (await this.prisma.customer.findFirst({ where: { leadId: id } }))?.id;
    if (!customerId) {
      const created = await this.convertLead(id, user);
      customerId = created.id;
    }
    const quotationNumber = await this.seq.next("quotation", "ZAT-QT");
    const selling = Number(lead.budget ?? 0);
    const q = await this.prisma.quotation.create({
      data: {
        quotationNumber,
        customerId,
        leadId: id,
        agentId: lead.assignedAgentId,
        branchId: lead.branchId,
        sellingTotal: selling,
        net: selling,
        status: "DRAFT",
        items: {
          create: [{ description: `Umrah package for ${lead.fullName}`, quantity: lead.adults || 1, sellingPrice: selling }],
        },
      },
    });
    await this.prisma.lead.update({ where: { id }, data: { status: "QUOTED" } });
    return q;
  }

  async bookingFromLead(id: string, user: AuthUser) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException();
    const customer = await this.convertLead(id, user);
    const existingQuote = await this.prisma.quotation.findFirst({
      where: { leadId: id },
      orderBy: { createdAt: "desc" },
    });
    const bookingNumber = await this.seq.next("umrah-bk", "ZAT-UM");
    const net = Number(existingQuote?.net ?? lead.budget ?? 0);
    const cost = Number(existingQuote?.costTotal ?? 0);
    const booking = await this.prisma.umrahBooking.create({
      data: {
        bookingNumber,
        customerId: customer.id,
        packageId: lead.packageId,
        quotationId: existingQuote?.id,
        agentId: lead.assignedAgentId,
        branchId: lead.branchId,
        departureDate: lead.travelDate,
        returnDate: lead.returnDate,
        cost,
        sellingPrice: Number(existingQuote?.sellingTotal ?? lead.budget ?? 0),
        discount: Number(existingQuote?.discount ?? 0),
        tax: Number(existingQuote?.tax ?? 0),
        net,
        paid: 0,
        balance: net,
        profit: net - cost,
        status: "CONFIRMED",
        workflowStep: "CUSTOMER_CONFIRMATION",
      },
    });
    if (existingQuote) {
      await this.prisma.quotation.update({ where: { id: existingQuote.id }, data: { status: "CONVERTED" } });
    }
    await this.prisma.lead.update({ where: { id }, data: { status: "CONFIRMED" } });
    await this.audit.log({ userId: user.id, action: "BOOKING", entity: "lead", entityId: id, after: booking });
    return booking;
  }

  async archive(id: string, user: AuthUser, archived: boolean) {
    const lead = await this.prisma.lead.update({
      where: { id },
      data: { archivedAt: archived ? new Date() : null },
    });
    await this.audit.log({ userId: user.id, action: archived ? "ARCHIVE" : "UNARCHIVE", entity: "lead", entityId: id });
    return lead;
  }

  async bulk(user: AuthUser, ids: string[], action: string, assignedUserId?: string) {
    if (!ids.length) throw new BadRequestException("No leads selected");
    if (action === "archive") {
      await this.prisma.lead.updateMany({ where: { id: { in: ids } }, data: { archivedAt: new Date() } });
    } else if (action === "unarchive") {
      await this.prisma.lead.updateMany({ where: { id: { in: ids } }, data: { archivedAt: null } });
    } else if (action === "assign") {
      await this.prisma.lead.updateMany({ where: { id: { in: ids } }, data: { assignedUserId: assignedUserId || user.id } });
    } else if (action === "delete") {
      await this.prisma.lead.deleteMany({ where: { id: { in: ids } } });
    } else {
      throw new BadRequestException("Unknown bulk action");
    }
    await this.audit.log({ userId: user.id, action: `BULK_${action.toUpperCase()}`, entity: "lead", after: { ids } });
    return { ok: true, count: ids.length };
  }

  async setFollowUpStatus(id: string, status: "COMPLETED" | "MISSED" | "CANCELLED" | "PENDING") {
    return this.prisma.followUp.update({ where: { id }, data: { status } });
  }

  async setTaskStatus(id: string, status: "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED") {
    return this.prisma.task.update({ where: { id }, data: { status } });
  }

  async quotationWorkspace(id: string) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
      include: { items: true, customer: true, lead: true, umrahBookings: true },
    });
    if (!quotation) throw new NotFoundException();
    return quotation;
  }

  async sendQuotation(id: string, user: AuthUser) {
    const q = await this.prisma.quotation.findUnique({ where: { id }, include: { customer: true, lead: true } });
    if (!q) throw new NotFoundException();
    const to = q.customer?.email || q.lead?.email;
    const html = `<p>Quotation ${q.quotationNumber}</p><p>Net: ${q.net} ${q.currency}</p>`;
    let mail = null;
    if (to) mail = await this.mail.send(to, `Quotation ${q.quotationNumber}`, html);
    const phone = q.customer?.whatsapp || q.lead?.whatsapp || q.lead?.mobile;
    let wa = null;
    if (phone) wa = await this.wa.send(phone, `Quotation ${q.quotationNumber} net ${q.net} ${q.currency}`);
    const updated = await this.prisma.quotation.update({ where: { id }, data: { status: "SENT" } });
    await this.audit.log({ userId: user.id, action: "SEND", entity: "quotation", entityId: id });
    return { quotation: updated, mail, wa };
  }

  async convertLead(id: string, user: AuthUser) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException("Lead not found");
    const existing = await this.prisma.customer.findFirst({ where: { leadId: id } });
    if (existing) return existing;
    const customerNumber = await this.seq.next("customer", "ZAT-CUS");
    const customer = await this.prisma.customer.create({
      data: {
        customerNumber,
        fullName: lead.fullName,
        fatherName: lead.fatherName,
        phone: lead.mobile,
        whatsapp: lead.whatsapp,
        email: lead.email,
        cnic: lead.cnic,
        passportNumber: lead.passport,
        branchId: lead.branchId,
        agentId: lead.assignedAgentId,
        leadId: lead.id,
      },
    });
    await this.prisma.lead.update({ where: { id }, data: { status: "CONFIRMED" } });
    await this.audit.log({ userId: user.id, action: "CONVERT", entity: "lead", entityId: id, after: customer });
    return customer;
  }

  async importLeads(user: AuthUser, rows: Record<string, string>[]) {
    const created = [];
    for (const row of rows) {
      const leadNumber = await this.seq.next("lead", "ZAT-LD");
      created.push(
        await this.prisma.lead.create({
          data: {
            leadNumber,
            fullName: row.fullName || row.name || "Unknown",
            mobile: row.mobile || row.phone || "",
            whatsapp: row.whatsapp,
            email: row.email,
            city: row.city,
            source: (row.source as never) || "OTHER",
            notes: row.notes,
            branchId: user.defaultBranchId,
            assignedUserId: user.id,
          },
        }),
      );
    }
    return { count: created.length, ids: created.map((c) => c.id) };
  }

  async upcomingFollowUps(user: AuthUser) {
    const branchScope =
      !user.isSuperAdmin && user.branchIds.length
        ? {
            OR: [
              { lead: { branchId: { in: user.branchIds } } },
              { customer: { branchId: { in: user.branchIds } } },
              { leadId: null, customerId: null },
            ],
          }
        : {};
    return this.prisma.followUp.findMany({
      where: {
        status: "PENDING",
        dueAt: { gte: new Date(Date.now() - 86400000) },
        ...branchScope,
      },
      include: { lead: true, customer: true, assignedUser: { select: { fullName: true } } },
      orderBy: { dueAt: "asc" },
      take: 100,
    });
  }

  async customerWorkspace(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        branch: true,
        agent: true,
        lead: true,
        passengers: true,
        quotations: true,
        followUps: true,
        tasks: true,
        umrahBookings: true,
        tickets: true,
        hotelBookings: true,
        starBookings: true,
        transportBookings: true,
        visaApplications: true,
        receipts: true,
        complaints: true,
        communications: { orderBy: { createdAt: "desc" } },
        passportHistory: { orderBy: { recordedAt: "desc" } },
        ocrExtracts: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!customer) throw new NotFoundException();
    const outstanding = customer.umrahBookings.reduce((s, b) => s + Number(b.balance), 0);
    const documents = await this.prisma.storedDocument.findMany({
      where: { entityType: "customer", entityId: id },
      orderBy: { createdAt: "desc" },
    });
    return { customer, outstanding, documents };
  }

  async updateCustomer(id: string, user: AuthUser, body: Record<string, unknown>) {
    const allowed = [
      "fullName",
      "fatherName",
      "gender",
      "dateOfBirth",
      "cnic",
      "passportNumber",
      "passportExpiry",
      "nationality",
      "phone",
      "whatsapp",
      "email",
      "address",
      "emergencyContact",
    ];
    const data: Record<string, unknown> = {};
    for (const k of allowed) {
      if (body[k] === undefined) continue;
      if (body[k] === "") data[k] = null;
      else if (["dateOfBirth", "passportExpiry"].includes(k) && typeof body[k] === "string") data[k] = new Date(body[k] as string);
      else data[k] = body[k];
    }
    const customer = await this.prisma.customer.update({ where: { id }, data: data as never });
    await this.audit.log({ userId: user.id, action: "UPDATE", entity: "customer", entityId: id, after: data });
    return customer;
  }

  async logCustomerCommunication(
    id: string,
    user: AuthUser,
    body: { channel: string; subject?: string; message: string; send?: boolean },
  ) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException();
    if (!body.message?.trim()) throw new BadRequestException("Message required");
    let delivery: unknown = null;
    if (body.send && body.channel === "EMAIL" && customer.email) {
      delivery = await this.mail.send(customer.email, body.subject ?? "Message", `<p>${body.message}</p>`);
    }
    if (body.send && body.channel === "WHATSAPP" && (customer.whatsapp || customer.phone)) {
      delivery = await this.wa.send(customer.whatsapp || customer.phone!, body.message);
    }
    const row = await this.prisma.communication.create({
      data: {
        channel: body.channel,
        subject: body.subject,
        body: body.message,
        customerId: id,
        userId: user.id,
      },
    });
    return { communication: row, delivery };
  }

  async addCustomerFollowUp(
    id: string,
    user: AuthUser,
    body: { dueAt: string; type?: string; subject: string; notes?: string; priority?: string },
  ) {
    if (!body.subject?.trim() || !body.dueAt) throw new BadRequestException("Subject and due date required");
    return this.prisma.followUp.create({
      data: {
        customerId: id,
        assignedUserId: user.id,
        dueAt: new Date(body.dueAt),
        type: (body.type as never) ?? "CALL",
        subject: body.subject,
        notes: body.notes,
        priority: (body.priority as never) ?? "MEDIUM",
      },
    });
  }

  async addCustomerTask(id: string, user: AuthUser, body: { title: string; description?: string; dueDate?: string }) {
    if (!body.title?.trim()) throw new BadRequestException("Title required");
    return this.prisma.task.create({
      data: {
        title: body.title,
        description: body.description,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        customerId: id,
        assignedUserId: user.id,
      },
    });
  }

  async setQuotationStatus(id: string, status: string, user: AuthUser) {
    const allowed = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"];
    if (!allowed.includes(status)) throw new BadRequestException("Invalid quotation status");
    const quotation = await this.prisma.quotation.update({ where: { id }, data: { status: status as never } });
    await this.audit.log({ userId: user.id, action: "STATUS", entity: "quotation", entityId: id, after: { status } });
    return quotation;
  }

  async bookingFromCustomer(id: string, user: AuthUser) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException();
    if (customer.leadId) return this.bookingFromLead(customer.leadId, user);
    const quote = await this.prisma.quotation.findFirst({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
    });
    const bookingNumber = await this.seq.next("umrah-bk", "ZAT-UM");
    const net = Number(quote?.net ?? 0);
    return this.prisma.umrahBooking.create({
      data: {
        bookingNumber,
        customerId: id,
        quotationId: quote?.id,
        agentId: customer.agentId,
        branchId: customer.branchId,
        net,
        sellingPrice: net,
        balance: net,
        status: "CONFIRMED",
        workflowStep: "CUSTOMER_CONFIRMATION",
      },
    });
  }

  async addPassenger(
    customerId: string,
    user: AuthUser,
    body: {
      fullName: string;
      fatherName?: string;
      passportNumber?: string;
      mobile?: string;
      whatsapp?: string;
      email?: string;
      gender?: "MALE" | "FEMALE" | "OTHER";
      cnic?: string;
      nationality?: string;
      address?: string;
      emergencyContact?: string;
      dateOfBirth?: string;
      passportExpiryDate?: string;
    },
  ) {
    if (!body.fullName?.trim()) throw new BadRequestException("Passenger name required");
    if (body.passportNumber) {
      const dup = await this.prisma.passenger.findFirst({
        where: { passportNumber: body.passportNumber, deletedAt: null },
      });
      if (dup) throw new BadRequestException(`Duplicate passport on passenger ${dup.fullName}`);
    }
    const pax = await this.prisma.passenger.create({
      data: {
        customerId,
        fullName: body.fullName.trim(),
        fatherName: body.fatherName,
        passportNumber: body.passportNumber,
        mobile: body.mobile,
        whatsapp: body.whatsapp,
        email: body.email,
        gender: body.gender,
        cnic: body.cnic,
        nationality: body.nationality,
        address: body.address,
        emergencyContact: body.emergencyContact,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
        passportExpiryDate: body.passportExpiryDate ? new Date(body.passportExpiryDate) : undefined,
      },
    });
    await this.audit.log({ userId: user.id, action: "CREATE", entity: "passenger", entityId: pax.id, after: body });
    return pax;
  }

  async addQuoteItem(id: string, body: { description: string; quantity?: number; sellingPrice?: number; cost?: number }) {
    const q = await this.prisma.quotation.findUnique({ where: { id } });
    if (!q) throw new NotFoundException();
    if (!body.description?.trim()) throw new BadRequestException("Description required");
    await this.prisma.quotationItem.create({
      data: {
        quotationId: id,
        description: body.description,
        quantity: Number(body.quantity ?? 1),
        sellingPrice: Number(body.sellingPrice ?? 0),
        cost: Number(body.cost ?? 0),
      },
    });
    return this.recalcQuote(id);
  }

  async removeQuoteItem(id: string, itemId: string) {
    const item = await this.prisma.quotationItem.findFirst({ where: { id: itemId, quotationId: id } });
    if (!item) throw new NotFoundException("Line item not found");
    await this.prisma.quotationItem.delete({ where: { id: itemId } });
    return this.recalcQuote(id);
  }

  async updateQuotation(
    id: string,
    user: AuthUser,
    body: { discount?: number; tax?: number; terms?: string; notes?: string; expiresAt?: string; currency?: string },
  ) {
    const q = await this.prisma.quotation.findUnique({ where: { id } });
    if (!q) throw new NotFoundException();
    await this.prisma.quotation.update({
      where: { id },
      data: {
        discount: body.discount === undefined ? undefined : Number(body.discount),
        tax: body.tax === undefined ? undefined : Number(body.tax),
        terms: body.terms,
        notes: body.notes,
        currency: body.currency,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : body.expiresAt === "" ? null : undefined,
      },
    });
    await this.audit.log({ userId: user.id, action: "UPDATE", entity: "quotation", entityId: id, after: body });
    return this.recalcQuote(id);
  }

  async listQuotations(user: AuthUser, q?: string, status?: string) {
    const branch =
      !user.isSuperAdmin && user.branchIds.length ? { branchId: { in: user.branchIds } } : {};
    return this.prisma.quotation.findMany({
      where: {
        ...branch,
        ...(status ? { status: status as never } : {}),
        ...(q
          ? {
              OR: [
                { quotationNumber: { contains: q, mode: "insensitive" } },
                { customer: { fullName: { contains: q, mode: "insensitive" } } },
                { lead: { fullName: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: { customer: { select: { id: true, fullName: true } }, lead: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async createQuotation(user: AuthUser, body: { customerId?: string; leadId?: string }) {
    if (body.leadId) return this.quoteFromLead(body.leadId, user);
    if (body.customerId) return this.quoteFromCustomer(body.customerId, user);
    throw new BadRequestException("customerId or leadId required");
  }

  async listPassengers(user: AuthUser, q?: string) {
    const branch =
      !user.isSuperAdmin && user.branchIds.length ? { customer: { branchId: { in: user.branchIds } } } : {};
    return this.prisma.passenger.findMany({
      where: {
        ...branch,
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: "insensitive" } },
                { passportNumber: { contains: q, mode: "insensitive" } },
                { cnic: { contains: q, mode: "insensitive" } },
                { mobile: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { customer: { select: { id: true, fullName: true, customerNumber: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  }

  private async recalcQuote(id: string) {
    const q = await this.prisma.quotation.findUnique({ where: { id }, include: { items: true } });
    if (!q) throw new NotFoundException();
    const sellingTotal = q.items.reduce((s, i) => s + Number(i.sellingPrice) * i.quantity, 0);
    const costTotal = q.items.reduce((s, i) => s + Number(i.cost) * i.quantity, 0);
    const net = sellingTotal - Number(q.discount) + Number(q.tax);
    return this.prisma.quotation.update({
      where: { id },
      data: { sellingTotal, costTotal, net },
      include: { items: true, customer: true, lead: true, umrahBookings: true },
    });
  }

  async today(user: AuthUser) {
    const branch =
      !user.isSuperAdmin && user.branchIds.length ? { branchId: { in: user.branchIds } } : {};
    const followScope =
      !user.isSuperAdmin && user.branchIds.length
        ? { lead: { branchId: { in: user.branchIds } } }
        : {};
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const [overdueFollowUps, todayFollowUps, tasksDue, newLeads, openQuotes, expiringQuotes] = await Promise.all([
      this.prisma.followUp.findMany({
        where: { status: "PENDING", dueAt: { lt: start }, ...followScope },
        include: {
          lead: { select: { id: true, fullName: true } },
          customer: { select: { id: true, fullName: true } },
        },
        orderBy: { dueAt: "asc" },
        take: 30,
      }),
      this.prisma.followUp.findMany({
        where: { status: "PENDING", dueAt: { gte: start, lte: end }, ...followScope },
        include: {
          lead: { select: { id: true, fullName: true } },
          customer: { select: { id: true, fullName: true } },
        },
        orderBy: { dueAt: "asc" },
        take: 30,
      }),
      this.prisma.task.findMany({
        where: { status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { lte: end }, ...followScope },
        include: { lead: { select: { id: true, fullName: true } } },
        orderBy: { dueDate: "asc" },
        take: 30,
      }),
      this.prisma.lead.findMany({
        where: { createdAt: { gte: start, lte: end }, archivedAt: null, ...branch },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.quotation.findMany({
        where: { status: { in: ["DRAFT", "SENT"] }, ...branch },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.quotation.findMany({
        where: {
          status: { in: ["DRAFT", "SENT"] },
          expiresAt: { lte: end },
          ...branch,
        },
        orderBy: { expiresAt: "asc" },
        take: 20,
      }),
    ]);
    return { overdueFollowUps, todayFollowUps, tasksDue, newLeads, openQuotes, expiringQuotes };
  }

  async mergeLeads(keepId: string, dropId: string, user: AuthUser) {
    if (!dropId) throw new BadRequestException("otherId required");
    if (keepId === dropId) throw new BadRequestException("Cannot merge a lead into itself");
    const [keep, drop] = await Promise.all([
      this.prisma.lead.findUnique({ where: { id: keepId } }),
      this.prisma.lead.findUnique({ where: { id: dropId } }),
    ]);
    if (!keep || !drop) throw new NotFoundException("Lead not found");
    await this.prisma.$transaction([
      this.prisma.leadNote.updateMany({ where: { leadId: dropId }, data: { leadId: keepId } }),
      this.prisma.communication.updateMany({ where: { leadId: dropId }, data: { leadId: keepId } }),
      this.prisma.followUp.updateMany({ where: { leadId: dropId }, data: { leadId: keepId } }),
      this.prisma.task.updateMany({ where: { leadId: dropId }, data: { leadId: keepId } }),
      this.prisma.quotation.updateMany({ where: { leadId: dropId }, data: { leadId: keepId } }),
      this.prisma.customer.updateMany({ where: { leadId: dropId }, data: { leadId: keepId } }),
      this.prisma.lead.update({
        where: { id: dropId },
        data: { archivedAt: new Date(), status: "CANCELLED", lostReason: `Merged into ${keep.leadNumber}` },
      }),
      this.prisma.leadNote.create({
        data: { leadId: keepId, userId: user.id, body: `Merged lead ${drop.leadNumber} (${drop.fullName}) into this record.` },
      }),
    ]);
    await this.audit.log({ userId: user.id, action: "MERGE", entity: "lead", entityId: keepId, after: { dropId } });
    return this.workspace(keepId);
  }

  async rescheduleFollowUp(id: string, dueAt: string) {
    const follow = await this.prisma.followUp.update({
      where: { id },
      data: { dueAt: new Date(dueAt), status: "PENDING" },
    });
    if (follow.leadId) {
      await this.prisma.lead.update({ where: { id: follow.leadId }, data: { nextFollowUpAt: follow.dueAt } });
    }
    return follow;
  }

  async quoteFromCustomer(id: string, user: AuthUser) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException();
    if (customer.leadId) return this.quoteFromLead(customer.leadId, user);
    const quotationNumber = await this.seq.next("quotation", "ZAT-QT");
    return this.prisma.quotation.create({
      data: {
        quotationNumber,
        customerId: id,
        agentId: customer.agentId,
        branchId: customer.branchId,
        status: "DRAFT",
        items: { create: [{ description: `Services for ${customer.fullName}`, quantity: 1, sellingPrice: 0 }] },
      },
    });
  }
}

