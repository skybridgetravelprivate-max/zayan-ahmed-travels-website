import { money } from "../finance/money";
import { isSerializationConflict } from "../common/serialization-conflict";
import { RESOURCES, actionPermission } from "../resources/registry";
import { refreshFollowUpLeads } from "./follow-up-state";
import { businessDay } from "./business-day";
import { ResourcesService } from "../resources/resources.service";
import { resourceScope, validateResourceLinks } from "../resources/resource-scope";
import { ManagementService } from "../management/management.service";
import { requirePermission } from "../auth/record-scope";
import { convertLeadToCustomer } from "./convert-lead";
import { convertQuotationToBooking } from "./convert-quotation";
import { AccountingService } from "../finance/accounting.service";
import { assertBranch } from "../auth/record-scope";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { SequenceService } from "../common/sequence.service";
import { AuditService } from "../common/audit.service";
import { NotifyService } from "../common/notify.service";
import { MailService } from "../common/mail.service";
import { WhatsAppService } from "../common/whatsapp.service";
import { AuthUser, can } from "../auth/auth.types";
import { LeadStatus, Prisma } from "@prisma/client";

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
    private accounting: AccountingService,
  ) {}

  private visibleResource(user: AuthUser, resource: string) {
    return can(user, actionPermission(RESOURCES[resource], "view")) ? resourceScope(user, resource) : { id: { in: [] } };
  }

  private branchIds(user: AuthUser) {
    return [...new Set([...user.branchIds, ...(user.defaultBranchId ? [user.defaultBranchId] : [])])];
  }

  async pipeline(
    user: AuthUser,
    filters: { q?: string; source?: string; priority?: string; assignedUserId?: string; archived?: string } = {},
  ) {
    const branch =
      !user.isSuperAdmin ? { branchId: { in: this.branchIds(user) } } : {};
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
      !user.isSuperAdmin ? { branchId: { in: this.branchIds(user) } } : {};
    const [open, overdue, quoted, confirmed, bySource] = await Promise.all([
      this.prisma.lead.count({ where: { archivedAt: null, status: { notIn: ["LOST", "CANCELLED", "CONFIRMED"] }, ...branch } }),
      can(user, "followup.view") ? this.prisma.followUp.count({
        where: { status: "PENDING", dueAt: { lt: new Date() }, ...resourceScope(user, "follow-ups") },
      }) : Promise.resolve(null),
      this.prisma.lead.count({ where: { status: "QUOTED", archivedAt: null, ...branch } }),
      this.prisma.lead.count({ where: { status: "CONFIRMED", archivedAt: null, ...branch } }),
      this.prisma.lead.groupBy({ by: ["source"], where: { archivedAt: null, ...branch }, _count: true }),
    ]);
    return { open, overdueFollowUps: overdue, quoted, confirmed, bySource };
  }

  async duplicates(user: AuthUser, mobile?: string, email?: string, cnic?: string, excludeId?: string) {
    const or = [];
    if (mobile) or.push({ mobile });
    if (email) or.push({ email });
    if (cnic) or.push({ cnic });
    if (!or.length) return [];
    return this.prisma.lead.findMany({
      where: {
        OR: or,
        ...(!user.isSuperAdmin ? { branchId: { in: this.branchIds(user) } } : {}),
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, leadNumber: true, fullName: true, mobile: true, email: true, status: true },
      take: 10,
    });
  }

  async customerDuplicates(user: AuthUser, phone?: string, email?: string, cnic?: string, passport?: string, excludeId?: string) {
    const or = [];
    if (phone) or.push({ phone }, { whatsapp: phone });
    if (email) or.push({ email });
    if (cnic) or.push({ cnic });
    if (passport) or.push({ passportNumber: passport });
    if (!or.length) return [];
    const customers = await this.prisma.customer.findMany({
      where: {
        OR: or,
        ...(!user.isSuperAdmin ? { branchId: { in: this.branchIds(user) } } : {}),
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, customerNumber: true, fullName: true, phone: true, email: true, passportNumber: true, cnic: true },
      take: 10,
    });
    const pax = await this.prisma.passenger.findMany({
      where: {
        ...(!user.isSuperAdmin ? { customer: { branchId: { in: this.branchIds(user) } } } : {}),
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

  async workspace(id: string, user: AuthUser, preview = false) {
    requirePermission(user, "lead.view");
    const lead = await this.prisma.lead.findFirst({
      where: { id, ...resourceScope(user, "leads") },
      include: {
        assignedUser: { select: { id: true, fullName: true, email: true } },
        assignedAgent: { select: { id: true, name: true } },
        branch: { select: { id: true, code: true, name: true } },
        package: can(user, "umrah.view"),
        followUps: {
          where: this.visibleResource(user, "follow-ups"),
          take: preview ? 20 : undefined,
          orderBy: { dueAt: "desc" },
        },
        tasks: {
          where: this.visibleResource(user, "tasks"),
          take: preview ? 20 : undefined,
          orderBy: { createdAt: "desc" },
        },
        quotations: {
          where: this.visibleResource(user, "quotations"),
          take: preview ? 20 : undefined,
          orderBy: { createdAt: "desc" },
        },
        customers: {
          where: this.visibleResource(user, "customers"),
          take: preview ? 20 : undefined,
        },
        leadNotes: {
          take: preview ? 20 : undefined,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { fullName: true } } },
        },
        communications: {
          take: preview ? 20 : undefined,
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!lead) throw new NotFoundException("Lead not found");
    const documents = await this.prisma.storedDocument.findMany({
      where: {
        entityType: "lead",
        entityId: id,
        ...(can(user, "document.view") ? {} : { id: { in: [] } }),
      },
      take: preview ? 20 : undefined,
      orderBy: { createdAt: "desc" },
    });
    const bookings = await this.prisma.umrahBooking.findMany({
      where: {
        customer: { leadId: id },
        ...this.visibleResource(user, "umrah-bookings"),
      },
      take: preview ? 20 : undefined,
      orderBy: { createdAt: "desc" },
    });
    const receipts = await this.prisma.receipt.findMany({
      where: {
        customer: { leadId: id },
        ...this.visibleResource(user, "receipts"),
      },
      take: preview ? 20 : undefined,
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

  async assign(id: string, user: AuthUser, assignedUserId?: string | null, assignedAgentId?: string | null, version?: string) {
    return new ManagementService(this.prisma, this.seq).assign(user, id, {
      ...(assignedUserId !== undefined ? { assignedUserId } : {}),
      ...(assignedAgentId !== undefined ? { assignedAgentId } : {}), version,
    });
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

  async addFollowUp(id: string, user: AuthUser, body: { dueAt: string; type?: string; subject: string; notes?: string; priority?: string }) {
    return new ResourcesService(this.prisma, this.seq, this.audit).create("follow-ups", user, { ...body, leadId: id, assignedUserId: user.id });
  }

  async addTask(id: string, user: AuthUser, body: { title: string; description?: string; dueDate?: string }) {
    return new ResourcesService(this.prisma, this.seq, this.audit).create("tasks", user, { ...body, leadId: id, assignedUserId: user.id });
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
    return this.prisma.$transaction(async tx => {
      const lead = await tx.lead.findUnique({ where: { id } });
      if (!lead) throw new NotFoundException();
      assertBranch(user, lead.branchId);
      const selling = money(lead.budget ?? "0");
      const customer = await convertLeadToCustomer(this.prisma, this.seq, this.audit, id, user, tx);
      const quotationNumber = await this.seq.next("quotation", "ZAT-QT", tx);
      const q = await tx.quotation.create({
        data: {
          quotationNumber,
          customerId: customer.id,
          leadId: id,
          agentId: lead.assignedAgentId,
          branchId: lead.branchId,
          sellingTotal: selling,
          net: selling,
          status: "DRAFT",
          items: {
            // The lead budget is the whole package total, not a per-passenger price.
            create: [{ description: `Umrah package for ${lead.fullName}`, quantity: 1, sellingPrice: selling }],
          },
        },
      });
      await tx.lead.update({ where: { id }, data: { status: "QUOTED" } });
      return q;
    });
  }

  async bookingFromLead(id: string, user: AuthUser) {
    return this.prisma.$transaction(async tx => {
      const customer = await convertLeadToCustomer(this.prisma, this.seq, this.audit, id, user, tx);
      const lead = await tx.lead.findUniqueOrThrow({ where: { id } });
      assertBranch(user, lead.branchId);
      let quote = await tx.quotation.findFirst({ where: { leadId: id }, orderBy: { createdAt: "desc" } });
      if (!quote) {
        const amount = money(lead.budget ?? "0");
        quote = await tx.quotation.create({ data: {
          quotationNumber: await this.seq.next("quotation", "ZAT-QT", tx),
          customerId: customer.id, leadId: id, agentId: lead.assignedAgentId,
          branchId: lead.branchId, sellingTotal: amount, net: amount, status: "DRAFT",
          items: { create: [{ description: `Umrah package for ${lead.fullName}`, quantity: 1, sellingPrice: amount }] },
        } });
      }
      let booking = await convertQuotationToBooking(tx, this.seq, this.accounting, quote.id, user);
      if (booking.status === "QUOTED" && booking.workflowStep === "QUOTATION") {
        booking = await tx.umrahBooking.update({ where: { id: booking.id }, data: {
          status: "CONFIRMED", workflowStep: "CUSTOMER_CONFIRMATION",
          packageId: lead.packageId, departureDate: lead.travelDate, returnDate: lead.returnDate,
        } });
      }
      await tx.lead.update({ where: { id }, data: { status: "CONFIRMED" } });
      return booking;
    });
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
    if (!Array.isArray(ids) || !ids.length || ids.length > 100 || ids.some(id => typeof id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(id))) throw new BadRequestException("Select at most 100 valid leads");
    if (!["archive", "unarchive", "assign", "delete"].includes(action)) throw new BadRequestException("Unknown bulk action");
    requirePermission(user, action === "assign" ? "lead.assign" : action === "delete" ? "lead.delete" : "lead.edit");
    const selected = [...new Set(ids)].sort();
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Lead" WHERE id IN (${Prisma.join(selected)}) ORDER BY id FOR UPDATE`);
      const leads = await tx.lead.findMany({ where: { id: { in: selected }, ...resourceScope(user, "leads") } });
      if (leads.length !== selected.length) throw new NotFoundException();
      if (action === "assign") {
        const target = assignedUserId || user.id;
        for (const lead of leads) await validateResourceLinks(tx as PrismaService, user, "leads", { assignedUserId: target }, lead);
        await tx.lead.updateMany({ where: { id: { in: selected } }, data: { assignedUserId: target } });
      } else if (action === "delete") {
        const resources = new ResourcesService(tx as PrismaService, new SequenceService(tx as PrismaService), new AuditService(tx as PrismaService));
        for (const id of selected) await resources.remove("leads", id, user);
      } else {
        await tx.lead.updateMany({ where: { id: { in: selected } }, data: { archivedAt: action === "archive" ? new Date() : null } });
      }
      await this.audit.log({ db: tx, userId: user.id, action: `BULK_${action.toUpperCase()}`, entity: "lead", after: { ids: selected } });
      return { ok: true, count: selected.length };
    }).catch(error => {
      if (isSerializationConflict(error)) throw new ConflictException("Records changed. Reload before retrying.");
      throw error;
    });
  }

  async setFollowUpStatus(id: string, status: "COMPLETED" | "MISSED" | "CANCELLED" | "PENDING", user: AuthUser) {
    return new ResourcesService(this.prisma, this.seq, this.audit).update("follow-ups", id, user, { status });
  }

  async setTaskStatus(id: string, status: "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED", user: AuthUser) {
    return new ResourcesService(this.prisma, this.seq, this.audit).update("tasks", id, user, { status });
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
    assertBranch(user, q.branchId);
    if (!["DRAFT", "SENT"].includes(q.status)) throw new ConflictException("Only an open quotation can be sent.");
    const to = q.customer?.email || q.lead?.email;
    const html = `<p>Quotation ${q.quotationNumber}</p><p>Net: ${q.net} ${q.currency}</p>`;
    let mail = null;
    if (to) mail = await this.mail.send(to, `Quotation ${q.quotationNumber}`, html);
    const phone = q.customer?.whatsapp || q.lead?.whatsapp || q.lead?.mobile;
    let wa = null;
    if (phone) wa = await this.wa.send(phone, `Quotation ${q.quotationNumber} net ${q.net} ${q.currency}`);
    if (![mail, wa].some(result => result && !(result as { skipped?: boolean }).skipped)) throw new ConflictException("No delivery channel accepted the quotation; its status is unchanged.");
    const updated = await this.prisma.quotation.update({ where: { id }, data: { status: "SENT" } });
    await this.audit.log({ userId: user.id, action: "SEND", entity: "quotation", entityId: id });
    return { quotation: updated, mail, wa };
  }

  async convertLead(id: string, user: AuthUser) {
    return convertLeadToCustomer(this.prisma, this.seq, this.audit, id, user);
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
    const branchScope = resourceScope(user, "follow-ups");
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

  async customerWorkspace(id: string, user: AuthUser, preview = false) {
    requirePermission(user, "customer.view");
    const customer = await this.prisma.customer.findFirst({
      where: { id, ...resourceScope(user, "customers") },
      include: {
        branch: true,
        agent: { select: { id: true, name: true } },
        lead: { where: this.visibleResource(user, "leads") },
        passengers: {
          where: this.visibleResource(user, "passengers"),
          take: preview ? 20 : undefined,
        },
        quotations: {
          where: this.visibleResource(user, "quotations"),
          take: preview ? 20 : undefined,
        },
        followUps: {
          where: this.visibleResource(user, "follow-ups"),
          take: preview ? 20 : undefined,
        },
        tasks: {
          where: this.visibleResource(user, "tasks"),
          take: preview ? 20 : undefined,
        },
        umrahBookings: {
          where: this.visibleResource(user, "umrah-bookings"),
          take: preview ? 20 : undefined,
        },
        tickets: {
          where: this.visibleResource(user, "tickets"),
          take: preview ? 20 : undefined,
        },
        hotelBookings: {
          where: this.visibleResource(user, "hotel-bookings"),
          take: preview ? 20 : undefined,
        },
        starBookings: {
          where: this.visibleResource(user, "star-bookings"),
          take: preview ? 20 : undefined,
        },
        transportBookings: {
          where: this.visibleResource(user, "transport-bookings"),
          take: preview ? 20 : undefined,
        },
        visaApplications: {
          where: this.visibleResource(user, "visa-applications"),
          take: preview ? 20 : undefined,
        },
        receipts: {
          where: this.visibleResource(user, "receipts"),
          take: preview ? 20 : undefined,
        },
        complaints: {
          where: this.visibleResource(user, "complaints"),
          take: preview ? 20 : undefined,
        },
        communications: {
          take: preview ? 20 : undefined,
          orderBy: { createdAt: "desc" },
        },
        passportHistory: {
          take: preview ? 20 : undefined,
          orderBy: { recordedAt: "desc" },
        },
        ocrExtracts: {
          where: can(user, "document.view") ? {} : { id: { in: [] } },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });
    if (!customer) throw new NotFoundException();
    const outstanding =
      !preview && can(user, "booking.view")
        ? Number(
            customer.umrahBookings
              .reduce(
                (sum, booking) => sum.add(booking.balance),
                new Prisma.Decimal(0),
              )
              .toFixed(2),
          )
        : null;
    const documents = await this.prisma.storedDocument.findMany({
      where: {
        entityType: "customer",
        entityId: id,
        ...(can(user, "document.view") ? {} : { id: { in: [] } }),
      },
      take: preview ? 20 : undefined,
      orderBy: { createdAt: "desc" },
    });
    return {
      customer,
      outstanding,
      outstandingScope: preview
        ? "not-calculated-in-preview"
        : "umrah-bookings-only",
      documents,
    };
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

  async addCustomerFollowUp(id: string, user: AuthUser, body: { dueAt: string; type?: string; subject: string; notes?: string; priority?: string }) {
    return new ResourcesService(this.prisma, this.seq, this.audit).create("follow-ups", user, { ...body, customerId: id, assignedUserId: user.id });
  }

  async addCustomerTask(id: string, user: AuthUser, body: { title: string; description?: string; dueDate?: string }) {
    return new ResourcesService(this.prisma, this.seq, this.audit).create("tasks", user, { ...body, customerId: id, assignedUserId: user.id });
  }

  async setQuotationStatus(id: string, status: string, user: AuthUser) {
    const allowed = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"];
    if (!allowed.includes(status)) throw new BadRequestException("Invalid quotation status");
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Quotation" WHERE id = ${id} FOR UPDATE`;
      const q = await tx.quotation.findUnique({ where: { id } });
      if (!q) throw new NotFoundException();
      assertBranch(user, q.branchId);
      if (q.status === "CONVERTED" || await tx.umrahBooking.findFirst({ where: { quotationId: id } })) throw new ConflictException("Converted quotation cannot change status");
      const quotation = await tx.quotation.update({ where: { id }, data: { status: status as never } });
      await this.audit.log({ userId: user.id, action: "STATUS", entity: "quotation", entityId: id, after: { status }, db: tx });
      return quotation;
    });
  }

  async bookingFromCustomer(id: string, user: AuthUser) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException();
    assertBranch(user, customer.branchId);
    if (customer.leadId) return this.bookingFromLead(customer.leadId, user);
    const quote = await this.prisma.quotation.findFirst({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
    });
    if (quote) return this.prisma.$transaction(async tx => {
      const booking = await convertQuotationToBooking(tx, this.seq, this.accounting, quote.id, user);
      if (booking.status !== "QUOTED" || booking.workflowStep !== "QUOTATION") return booking;
      return tx.umrahBooking.update({ where: { id: booking.id }, data: { status: "CONFIRMED", workflowStep: "CUSTOMER_CONFIRMATION" } });
    });
    const bookingNumber = await this.seq.next("umrah-bk", "ZAT-UM");
    return this.prisma.umrahBooking.create({
      data: {
        bookingNumber,
        customerId: id,
        agentId: customer.agentId,
        branchId: customer.branchId,
        net: 0,
        sellingPrice: 0,
        balance: 0,
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
    if (!body || typeof body.description !== "string" || !body.description.trim() || body.description.length > 10000) throw new BadRequestException("Description required (maximum 10000 characters)");
    const quantity = body.quantity ?? 1;
    const sellingPrice = body.sellingPrice ?? 0;
    const cost = body.cost ?? 0;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 2147483647) throw new BadRequestException("Quantity must be a positive whole number");
    if ([sellingPrice, cost].some(value => typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1e12)) throw new BadRequestException("Enter valid non-negative quotation amounts");
    return this.prisma.$transaction(async tx => {
      await this.editableQuotation(tx, id);
      await tx.quotationItem.create({
        data: {
          quotationId: id,
          description: body.description.trim(),
          quantity,
          sellingPrice,
          cost,
        },
      });
      return this.recalcQuote(id, tx);
    });
  }

  async removeQuoteItem(id: string, itemId: string) {
    return this.prisma.$transaction(async tx => {
      await this.editableQuotation(tx, id);
      const item = await tx.quotationItem.findFirst({ where: { id: itemId, quotationId: id } });
      if (!item) throw new NotFoundException("Line item not found");
      await tx.quotationItem.delete({ where: { id: itemId } });
      return this.recalcQuote(id, tx);
    });
  }

  async updateQuotation(
    id: string,
    user: AuthUser,
    body: { discount?: number; tax?: number; terms?: string; notes?: string; expiresAt?: string; currency?: string },
  ) {
    for (const amount of [body.discount, body.tax]) {
      if (amount !== undefined && (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || amount > 1e12)) throw new BadRequestException("Invalid quotation amount");
    }
    if (body.expiresAt && !Number.isFinite(new Date(body.expiresAt).getTime())) throw new BadRequestException("Invalid expiry date");
    return this.prisma.$transaction(async tx => {
      const q = await this.editableQuotation(tx, id);
      assertBranch(user, q.branchId);
      await tx.quotation.update({
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
      await this.audit.log({ userId: user.id, action: "UPDATE", entity: "quotation", entityId: id, after: body, db: tx });
      return this.recalcQuote(id, tx);
    });
  }

  async listQuotations(user: AuthUser, q?: string, status?: string) {
    const branch =
      !user.isSuperAdmin ? { branchId: { in: this.branchIds(user) } } : {};
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
      !user.isSuperAdmin ? { customer: { branchId: { in: this.branchIds(user) } } } : {};
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

  private async editableQuotation(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM "Quotation" WHERE id = ${id} FOR UPDATE`;
    const q = await tx.quotation.findUnique({ where: { id } });
    if (!q) throw new NotFoundException();
    if (["CONVERTED", "REJECTED", "EXPIRED"].includes(q.status) || await tx.umrahBooking.findFirst({ where: { quotationId: id } })) throw new ConflictException("Quotation is no longer editable");
    return q;
  }

  private async recalcQuote(id: string, tx: Prisma.TransactionClient) {
    const q = await tx.quotation.findUnique({ where: { id }, include: { items: true } });
    if (!q) throw new NotFoundException();
    const sellingTotal = q.items.reduce((s, i) => s.plus(i.sellingPrice.mul(i.quantity)), new Prisma.Decimal(0));
    const costTotal = q.items.reduce((s, i) => s.plus(i.cost.mul(i.quantity)), new Prisma.Decimal(0));
    const net = sellingTotal.minus(q.discount).plus(q.tax);
    if (net.isNegative()) throw new BadRequestException("Quotation net cannot be negative");
    return tx.quotation.update({
      where: { id },
      data: { sellingTotal, costTotal, net },
      include: { items: true, customer: true, lead: true, umrahBookings: true },
    });
  }

  async today(user: AuthUser, now = new Date()) {
    const branch =
      !user.isSuperAdmin ? { branchId: { in: this.branchIds(user) } } : {};
    const followScope = resourceScope(user, "follow-ups");
    const taskScope = resourceScope(user, "tasks");
    const access = { followUps: can(user, "followup.view"), tasks: can(user, "task.view"), quotations: can(user, "quotation.view") };
    const settings = await this.prisma.companySettings.findFirst({ select: { timezone: true } });
    const timeZone = settings?.timezone || "Asia/Karachi";
    const { start, endExclusive } = businessDay(timeZone, now);
    const [overdueFollowUps, todayFollowUps, tasksDue, newLeads, openQuotes, expiringQuotes] = await Promise.all([
      access.followUps ? this.prisma.followUp.findMany({
        where: { status: "PENDING", dueAt: { lt: start }, ...followScope },
        include: {
          lead: { select: { id: true, fullName: true } },
          customer: { select: { id: true, fullName: true } },
        },
        orderBy: { dueAt: "asc" },
        take: 30,
      }) : Promise.resolve([]),
      access.followUps ? this.prisma.followUp.findMany({
        where: { status: "PENDING", dueAt: { gte: start, lt: endExclusive }, ...followScope },
        include: {
          lead: { select: { id: true, fullName: true } },
          customer: { select: { id: true, fullName: true } },
        },
        orderBy: { dueAt: "asc" },
        take: 30,
      }) : Promise.resolve([]),
      access.tasks ? this.prisma.task.findMany({
        where: { status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { lt: endExclusive }, ...taskScope },
        include: { lead: { select: { id: true, fullName: true } }, customer: { select: { id: true, fullName: true } } },
        orderBy: { dueDate: "asc" },
        take: 30,
      }) : Promise.resolve([]),
      this.prisma.lead.findMany({
        where: { createdAt: { gte: start, lt: endExclusive }, archivedAt: null, ...branch },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      access.quotations ? this.prisma.quotation.findMany({
        where: { status: { in: ["DRAFT", "SENT"] }, ...branch },
        orderBy: { createdAt: "desc" },
        take: 20,
      }) : Promise.resolve([]),
      access.quotations ? this.prisma.quotation.findMany({
        where: {
          status: { in: ["DRAFT", "SENT"] },
          expiresAt: { lt: endExclusive },
          ...branch,
        },
        orderBy: { expiresAt: "asc" },
        take: 20,
      }) : Promise.resolve([]),
    ]);
    return { overdueFollowUps, todayFollowUps, tasksDue, newLeads, openQuotes, expiringQuotes, access, timeZone, day: { start, endExclusive } };
  }

  async mergeLeads(keepId: string, dropId: string, user: AuthUser) {
    requirePermission(user, "lead.edit");
    requirePermission(user, "lead.view");
    if (!dropId || keepId === dropId) throw new BadRequestException("Select two different leads");
    const ids = [keepId, dropId].sort();
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Lead" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`);
      const rows = await tx.lead.findMany({ where: { id: { in: ids }, ...resourceScope(user, "leads") } });
      const keep = rows.find(r => r.id === keepId), drop = rows.find(r => r.id === dropId);
      if (!keep || !drop) throw new NotFoundException("Lead not found");
      if (keep.branchId !== drop.branchId) throw new BadRequestException("Only leads in the same branch can be merged");
      if (keep.archivedAt) throw new BadRequestException("Select an active target lead");
      await tx.leadNote.updateMany({ where: { leadId: dropId }, data: { leadId: keepId } });
      await tx.communication.updateMany({ where: { leadId: dropId }, data: { leadId: keepId } });
      await tx.followUp.updateMany({ where: { leadId: dropId }, data: { leadId: keepId } });
      await tx.task.updateMany({ where: { leadId: dropId }, data: { leadId: keepId } });
      await tx.quotation.updateMany({ where: { leadId: dropId }, data: { leadId: keepId } });
      await tx.customer.updateMany({ where: { leadId: dropId }, data: { leadId: keepId } });
      await tx.lead.update({ where: { id: dropId }, data: { archivedAt: new Date(), status: "CANCELLED", lostReason: `Merged into ${keep.leadNumber}` } });
      await tx.leadNote.create({ data: { leadId: keepId, userId: user.id, body: `Merged lead ${drop.leadNumber} (${drop.fullName}) into this record.` } });
      await refreshFollowUpLeads(tx as PrismaService, ids);
      await this.audit.log({ db: tx, userId: user.id, action: "MERGE", entity: "lead", entityId: keepId, after: { dropId } });
    });
    return this.workspace(keepId, user);
  }

  async rescheduleFollowUp(id: string, dueAt: string, user: AuthUser) {
    return new ResourcesService(this.prisma, this.seq, this.audit).update("follow-ups", id, user, { dueAt, status: "PENDING" });
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
