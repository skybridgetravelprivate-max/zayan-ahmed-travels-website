import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, TicketStatus, UmrahBookingStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { agencyForUser } from "./agency-access";

const requestSelect = { id: true, leadId: true, kind: true, subject: true, message: true, status: true, reply: true, createdAt: true, updatedAt: true } as const;
const id = (value: string) => {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(value)) throw new NotFoundException();
  return value;
};
export function agencyPage(raw?: string) {
  const page = Number(raw ?? "1");
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw new BadRequestException("Invalid page");
  return { skip: (page - 1) * 30, take: 30 };
}

@Injectable()
export class AgencyService {
  constructor(private db: PrismaService, private audit: AuditService) {}

  private async publicRequests<T extends { leadId: string | null }>(rows: T[], agency: { id: string; branchId: string | null }) {
    const leadIds = rows.flatMap(row => row.leadId ? [row.leadId] : []);
    const leads = await this.db.lead.findMany({
      where: { id: { in: leadIds }, assignedAgentId: agency.id, branchId: agency.branchId },
      select: { id: true, leadNumber: true },
    });
    const quotes = await this.db.quotation.findMany({
      where: { leadId: { in: leads.map(lead => lead.id) }, agentId: agency.id, branchId: agency.branchId, status: { in: ["SENT", "ACCEPTED", "CONVERTED"] } },
      select: { leadId: true, quotationNumber: true, status: true },
      orderBy: [{ issuedAt: "desc" }, { id: "asc" }],
    });
    return rows.map(({ leadId, ...row }) => ({
      ...row,
      operationalReference: leads.find(lead => lead.id === leadId)?.leadNumber || null,
      quotationReferences: quotes.filter(quote => quote.leadId === leadId).map(quote => `${quote.quotationNumber} (${quote.status})`).join(", ") || null,
    }));
  }

  async identity(userId: string) {
    const agency = await agencyForUser(this.db, userId);
    return { userId, documentsEnabled: process.env.AGENT_DOCUMENTS_ENABLED === "true", agency: { id: agency.id, name: agency.name, company: agency.company }, capabilities: ["catalogue", "requests", "quotations", "bookings"] };
  }

  async catalogue(userId: string, page?: string) {
    await agencyForUser(this.db, userId);
    const where = { isPublic: true, status: "ACTIVE" };
    const [rows, total] = await Promise.all([
      this.db.umrahPackage.findMany({ where, ...agencyPage(page), orderBy: [{ createdAt: "desc" }, { id: "asc" }], select: { id: true, packageNumber: true, name: true, departureCity: true, arrivalCity: true, departureDate: true, returnDate: true, durationDays: true, makkahNights: true, madinahNights: true, roomType: true, adultPrice: true, childPrice: true, infantPrice: true, includesVisa: true, includesTransport: true, includesMeals: true, includesZiyarat: true } }),
      this.db.umrahPackage.count({ where }),
    ]);
    return { rows, total, page: Number(page || 1), pageSize: 30, availability: "Published catalogue; staff confirmation required. Prices use the existing package price basis; confirm currency and occupancy with staff." };
  }

  async requests(userId: string, page?: string) {
    const agency = await agencyForUser(this.db, userId);
    const where = { agentId: agency.id };
    const [rows, total] = await Promise.all([this.db.agencyRequest.findMany({ where, ...agencyPage(page), select: requestSelect, orderBy: [{ createdAt: "desc" }, { id: "asc" }] }), this.db.agencyRequest.count({ where })]);
    return { rows: await this.publicRequests(rows, agency), total, pageSize: 30 };
  }

  async request(userId: string, requestId: string) {
    const agency = await agencyForUser(this.db, userId);
    const row = await this.db.agencyRequest.findFirst({ where: { id: id(requestId), agentId: agency.id }, select: requestSelect });
    if (!row) throw new NotFoundException();
    return (await this.publicRequests([row], agency))[0];
  }

  async submit(userId: string, body: Record<string, unknown>, key?: string) {
    const agency = await agencyForUser(this.db, userId);
    if (!key || !/^[A-Za-z0-9_-]{16,80}$/.test(key)) throw new BadRequestException("A durable request key is required");
    if (!body || Object.keys(body).some(k => !["kind", "subject", "message"].includes(k))) throw new BadRequestException("Unsupported request fields");
    const { kind, subject, message } = body;
    if (!["ENQUIRY", "BOOKING", "CHANGE", "CANCELLATION", "PAYMENT_EVIDENCE"].includes(String(kind)) || typeof kind !== "string" || typeof subject !== "string" || !subject.trim() || subject.length > 160 || typeof message !== "string" || !message.trim() || message.length > 4000) throw new BadRequestException("Choose a supported request and provide a subject and message");
    const data = { kind, subject: subject.trim(), message: message.trim() };
    const fingerprint = createHash("sha256").update(JSON.stringify(data)).digest("hex");
    const saved = await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`agency-request:${agency.id}:${key}`}, 5))::text`;
      const previous = await tx.agencyRequest.findUnique({ where: { agentId_requestKey: { agentId: agency.id, requestKey: key } } });
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new ConflictException("This request key belongs to a different submission; review request history");
        return tx.agencyRequest.findUniqueOrThrow({ where: { id: previous.id }, select: requestSelect });
      }
      const row = await tx.agencyRequest.create({ data: { ...data, agentId: agency.id, createdById: userId, requestKey: key, fingerprint }, select: requestSelect });
      await this.audit.log({ userId, action: "agency.request", entity: "AgencyRequest", entityId: row.id, after: { kind }, db: tx });
      return row;
    });
    return (await this.publicRequests([saved], agency))[0];
  }

  async quotations(userId: string, page?: string) {
    const agency = await agencyForUser(this.db, userId);
    // Only explicitly sent/accepted quotations are released to the agency.
    const where = { agentId: agency.id, branchId: agency.branchId, status: { in: ["SENT", "ACCEPTED", "CONVERTED"] as ("SENT" | "ACCEPTED" | "CONVERTED")[] } };
    const [rows, total] = await Promise.all([this.db.quotation.findMany({ where, ...agencyPage(page), orderBy: [{ issuedAt: "desc" }, { id: "asc" }], select: { id: true, quotationNumber: true, issuedAt: true, expiresAt: true, currency: true, net: true, status: true } }), this.db.quotation.count({ where })]);
    return { rows, total, pageSize: 30 };
  }

  async bookings(userId: string, page?: string, query: { q?: string; service?: string; status?: string; from?: string; to?: string } = {}) {
    const agency = await agencyForUser(this.db, userId);
    if (Object.values(query).some(value => value !== undefined && typeof value !== "string")) throw new BadRequestException("Invalid booking filters");
    const q = query.q?.trim() || "";
    const service = query.service || "";
    const status = query.status || "";
    const umrahStatuses = Object.values(UmrahBookingStatus);
    const ticketStatuses = Object.values(TicketStatus);
    if (q.length > 80 || !["", "umrah", "hotels", "tickets"].includes(service)
      || (status && ![...umrahStatuses, ...ticketStatuses, "TENTATIVE", "DEFINITE"].includes(status))) throw new BadRequestException("Unsupported booking filter");
    const date = (value?: string) => {
      if (!value) return undefined;
      const parsed = new Date(`${value}T00:00:00.000Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new BadRequestException("Invalid created date");
      return parsed;
    };
    const from = date(query.from), to = date(query.to);
    if (from && to && from > to) throw new BadRequestException("Invalid created date range");
    const where = { agentId: agency.id, branchId: agency.branchId, createdAt: { gte: from, lt: to ? new Date(to.getTime() + 86400000) : undefined } };
    const excluded = (kind: string) => !!service && service !== kind;
    const umrahWhere: Prisma.UmrahBookingWhereInput = { ...where, bookingNumber: { contains: q, mode: "insensitive" },
      ...(excluded("umrah") || (status && !umrahStatuses.includes(status as UmrahBookingStatus)) ? { id: { in: [] } } : { status: status ? status as UmrahBookingStatus : undefined }) };
    const hotelWhere: Prisma.HotelBookingWhereInput = { ...where, bookingNumber: { contains: q, mode: "insensitive" },
      ...(excluded("hotels") ? { id: { in: [] } } : { status: status ? { equals: status, mode: "insensitive" } : undefined }) };
    const ticketWhere: Prisma.TicketSaleWhereInput = { ...where, ticketNumber: { contains: q, mode: "insensitive" },
      ...(excluded("tickets") || (status && !ticketStatuses.includes(status as TicketStatus)) ? { id: { in: [] } } : { status: status ? status as TicketStatus : undefined }) };
    const paging = agencyPage(page);
    const [umrah, hotels, tickets, umrahCount, hotelCount, ticketCount] = await Promise.all([
      this.db.umrahBooking.findMany({ where: umrahWhere, ...paging, orderBy: [{ createdAt: "desc" }, { id: "asc" }], select: { id: true, bookingNumber: true, status: true, departureDate: true, returnDate: true, net: true, paid: true, balance: true } }),
      this.db.hotelBooking.findMany({ where: hotelWhere, ...paging, orderBy: [{ createdAt: "desc" }, { id: "asc" }], select: { id: true, bookingNumber: true, status: true, checkIn: true, checkOut: true, net: true, paid: true, balance: true } }),
      this.db.ticketSale.findMany({ where: ticketWhere, ...paging, orderBy: [{ createdAt: "desc" }, { id: "asc" }], select: { id: true, ticketNumber: true, status: true, net: true, paidAmount: true } }),
      this.db.umrahBooking.count({ where: umrahWhere }), this.db.hotelBooking.count({ where: hotelWhere }), this.db.ticketSale.count({ where: ticketWhere }),
    ]);
    return { umrah, hotels, tickets, total: umrahCount + hotelCount + ticketCount, hasNext: Math.max(umrahCount, hotelCount, ticketCount) > paging.skip + paging.take, notice: "Each page shows up to 30 records per service. These are booking balances, not a posted agency statement. Ticket records do not establish live supplier issuance." };
  }
}
