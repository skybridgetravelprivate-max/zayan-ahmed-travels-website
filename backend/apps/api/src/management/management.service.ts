import { businessDate } from "../crm/business-day";
import { isSerializationConflict } from "../common/serialization-conflict";
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthUser, can } from "../auth/auth.types";
import { branchIds, customerBranchWhere } from "../auth/record-scope";
import { AuditService } from "../common/audit.service";
import { PrismaService } from "../common/prisma.service";
import { SequenceService } from "../common/sequence.service";
import { ResourcesService } from "../resources/resources.service";
import { RESOURCES } from "../resources/registry";
import { assertPasswordPolicy, hashPassword } from "../common/password";
import { allowedModule, fieldsFor, MANAGEMENT, modelFor, moduleContract } from "./management.catalog";
import { packageCatalog } from "../umrah/package-catalog";
import { parseFields } from "../resources/resource-contract";
import { resourceScope, validateResourceLinks } from "../resources/resource-scope";
import { StaffAccessService } from "../auth/staff-access.service";

export { parseFields } from "../resources/resource-contract";

/** A constrained staff console over the existing resource/domain services. */
@Injectable()
export class ManagementService {
  constructor(private prisma: PrismaService, private seq: SequenceService) {}

  catalog(user: AuthUser) {
    const modules = Object.keys(MANAGEMENT)
      .filter((key) => allowedModule(user, key))
      .map((key) => moduleContract(user, key));
    // Website content has its own guarded API; do not enable generic CMS record access.
    if (
      can(user, "cms.view") &&
      !modules.some((module) => module.key === "cms-pages")
    )
      modules.push({
        key: "cms-pages",
        title: "Website pages",
        group: "Website",
        fields: [],
        writeFields: [],
        canCreate: false,
        canEdit: false,
      });
    return modules;
  }
  async umrahCatalog(user: AuthUser) {
    if (!can(user, "umrah.view")) throw new ForbiddenException();
    const rows = await this.prisma.umrahPackage.findMany({ take: 1001, orderBy: { packageNumber: "asc" }, select: {
      id: true, packageNumber: true, flightInfo: true, departureCity: true, arrivalCity: true, departureDate: true,
      makkahNights: true, madinahNights: true, roomType: true, adultPrice: true, childPrice: true, infantPrice: true,
      status: true, isPublic: true, description: true, makkahHotel: { select: { name: true, distance: true } }, madinahHotel: { select: { name: true, distance: true } },
    } });
    return { ...packageCatalog(user, rows.slice(0, 1000)), truncated: rows.length > 1000 };
  }
  async options(user: AuthUser, resource: string, q = "") {
    if (q.length > 100) throw new BadRequestException("Invalid search");
    if (resource === "branches") {
      const where = {
        ...(!user.isSuperAdmin ? { id: { in: branchIds(user) } } : {}),
        ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
      };
      return {
        data: await this.prisma.branch.findMany({
          where,
          select: { id: true, name: true },
          take: 20,
          orderBy: { name: "asc" },
        }),
      };
    }
    if (
      resource !== "users" ||
      ![
        "lead.view",
        "lead.assign",
        "task.view",
        "task.edit",
        "task.create",
        "followup.view",
        "followup.edit",
        "followup.create",
      ].some((p) => can(user, p))
    )
      throw new ForbiddenException();
    const where = {
      status: "ACTIVE" as const,
      deletedAt: null,
      ...(!user.isSuperAdmin
        ? {
            OR: [
              { defaultBranchId: { in: branchIds(user) } },
              { branches: { some: { branchId: { in: branchIds(user) } } } },
            ],
          }
        : {}),
      ...(q ? { fullName: { contains: q, mode: "insensitive" as const } } : {}),
    };
    return {
      data: await this.prisma.user.findMany({
        where,
        select: { id: true, fullName: true },
        take: 20,
        orderBy: { fullName: "asc" },
      }),
    };
  }
  private spec(user: AuthUser, key: string) {
    if (!allowedModule(user, key)) throw new ForbiddenException("Module access denied");
    return moduleContract(user, key);
  }
  private delegate(db: PrismaService, resource: string) {
    return new ResourcesService(db, this.seq, new AuditService(db)).delegate(resource);
  }
  scope(user: AuthUser, resource: string): Record<string, unknown> {
    return resourceScope(user, resource);
  }
  private projection(resource: string, row: Record<string, unknown>) {
    const out: Record<string, unknown> = { id: row.id };
    for (const f of fieldsFor(resource)) out[f.name] = row[f.name] ?? null;
    out.version = row.updatedAt instanceof Date ? row.updatedAt.toISOString() : null;
    return out;
  }
  async list(user: AuthUser, resource: string, query: Record<string, string>) {
    this.spec(user, resource);
    if (
      (query.q !== undefined && typeof query.q !== "string") ||
      (query.page !== undefined && typeof query.page !== "string")
    )
      throw new BadRequestException("Invalid search");
    const page = Number(query.page ?? 1);
    const q = query.q?.trim() ?? "";
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 10000 ||
      q.length > 100
    )
      throw new BadRequestException("Invalid search");
    const where = this.scope(user, resource);
    const search = (RESOURCES[resource].search ?? []).filter((k) =>
      fieldsFor(resource).some((f) => f.name === k),
    );
    if (q && search.length)
      where.OR = search.map((k) => ({
        [k]: { contains: q, mode: "insensitive" },
      }));
    const select = Object.fromEntries(
      [
        "id",
        ...fieldsFor(resource).map((f) => f.name),
        ...(modelFor(resource)?.fields.some((f) => f.name === "updatedAt")
          ? ["updatedAt"]
          : []),
      ].map((k) => [k, true]),
    );
    const predicates: Record<string, unknown>[] = [where];
    const fields = fieldsFor(resource);
    const filterable = [
      "leads",
      "customers",
      "tasks",
      "follow-ups",
      "quotations",
      "complaints",
    ].includes(resource);
    for (const key of [
      "status",
      "assignedUserId",
      "branchId",
      "from",
      "to",
      "sort",
    ]) {
      if (
        query[key] !== undefined &&
        (typeof query[key] !== "string" || query[key].length > 100)
      )
        throw new BadRequestException("Invalid filter");
      if (query[key] && !filterable)
        throw new BadRequestException(
          "Filters are not supported for this module",
        );
    }
    for (const key of ["status", "assignedUserId", "branchId"])
      if (query[key]) {
        const field = fields.find((field) => field.name === key);
        if (
          !field ||
          (field.options && !field.options.includes(query[key])) ||
          (!field.options && !/^[A-Za-z0-9_-]{1,80}$/.test(query[key]))
        )
          throw new BadRequestException("Invalid filter");
        predicates.push({ [key]: query[key] });
      }
    if (query.from || query.to) {
      const settings = await this.prisma.companySettings.findFirst({
        select: { timezone: true },
      });
      try {
        const timeZone = settings?.timezone || "Asia/Karachi";
        const gte = query.from ? businessDate(timeZone, query.from) : undefined;
        const lt = query.to
          ? businessDate(timeZone, query.to, true)
          : undefined;
        if (gte && lt && gte >= lt) throw new RangeError("Invalid date range");
        predicates.push({ createdAt: { gte, lt } });
      } catch {
        throw new BadRequestException("Invalid company-calendar date range");
      }
    }
    const model = modelFor(resource)!;
    let sort = model.fields.some((f) => f.name === "createdAt")
      ? "createdAt"
      : "id";
    let direction: "asc" | "desc" = "desc";
    if (query.sort && query.sort !== "newest") {
      if (query.sort === "oldest") direction = "asc";
      else if (
        query.sort === "updated" &&
        model.fields.some((f) => f.name === "updatedAt")
      )
        sort = "updatedAt";
      else if (query.sort === "name") {
        const field = [
          "fullName",
          "name",
          "title",
          "subject",
          "quotationNumber",
          "complaintNumber",
        ].find((name) => fields.some((f) => f.name === name));
        if (!field) throw new BadRequestException("Unsupported sort");
        sort = field;
        direction = "asc";
      } else throw new BadRequestException("Unsupported sort");
    }
    const db = this.delegate(this.prisma, resource),
      filtered = predicates.length === 1 ? where : { AND: predicates };
    const [rows, total] = await Promise.all([
      db.findMany({
        where: filtered,
        select,
        orderBy: [
          { [sort]: direction },
          ...(sort === "id" ? [] : [{ id: direction }]),
        ],
        skip: (page - 1) * 20,
        take: 20,
      }),
      db.count({ where: filtered }),
    ]);
    const data = rows.map((row) => this.projection(resource, row));
    return {
      data:
        query.presentation === "true"
          ? await this.presentRows(user, resource, data)
          : data,
      total,
      page,
      pageSize: 20,
    };
  }

  async summary(user: AuthUser, resource: string, id: string) {
    return (
      await this.presentRows(user, resource, [
        await this.detail(user, resource, id),
      ])
    )[0];
  }

  /** Batched, bounded labels from authorized records; never unrestricted relation includes. */
  private async presentRows(
    user: AuthUser,
    resource: string,
    rows: Record<string, unknown>[],
  ) {
    const timeZone =
      (
        await this.prisma.companySettings.findFirst({
          select: { timezone: true },
        })
      )?.timezone || "Asia/Karachi";
    const labels = new Map<
      string,
      { id: string; label: string; resource: string; link: boolean }
    >();
    for (const field of fieldsFor(resource).filter(
      (field) => field.reference,
    )) {
      const reference = field.reference!;
      const ids = [
        ...new Set(
          rows
            .map((row) => row[field.name])
            .filter((id): id is string => typeof id === "string" && !!id),
        ),
      ];
      if (!ids.length) continue;
      let scope: Record<string, unknown>;
      const link = allowedModule(user, reference);
      if (reference === "branches")
        scope = user.isSuperAdmin ? {} : { id: { in: branchIds(user) } };
      else if (reference === "users")
        scope = user.isSuperAdmin
          ? {}
          : {
              OR: [
                { defaultBranchId: { in: branchIds(user) } },
                { branches: { some: { branchId: { in: branchIds(user) } } } },
              ],
            };
      else {
        if (!link) continue;
        scope = this.scope(user, reference);
      }
      const candidates = [
        "fullName",
        "name",
        "title",
        "customerNumber",
        "leadNumber",
        "bookingNumber",
        "ticketNumber",
        "receiptNo",
        "code",
        "roomNumber",
      ];
      const names = candidates.filter((name) =>
        fieldsFor(reference).some((f) => f.name === name),
      );
      const selected = Object.fromEntries(
        ["id", ...names].map((name) => [name, true]),
      );
      const linked = await this.delegate(this.prisma, reference).findMany({
        where: { AND: [scope, { id: { in: ids } }] },
        select: selected,
        take: 20,
      });
      for (const row of linked) {
        const label = names
          .map((name) => row[name])
          .filter((value) => typeof value === "string" && value)
          .slice(0, 2)
          .join(" · ");
        if (label)
          labels.set(`${field.name}:${row.id}`, {
            id: String(row.id),
            label,
            resource: reference,
            link,
          });
      }
    }
    return rows.map((row) => ({
      ...row,
      presentation: {
        timeZone,
        references: Object.fromEntries(
          fieldsFor(resource)
            .filter((f) => f.reference && row[f.name])
            .map((f) => [
              f.name,
              labels.get(`${f.name}:${row[f.name]}`) || {
                label: "Restricted or unavailable record",
                link: false,
              },
            ]),
        ),
      },
    }));
  }

  async detail(user: AuthUser, resource: string, id: string, db = this.prisma) {
    this.spec(user, resource);
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new NotFoundException();
    const rows = await this.delegate(db, resource).findMany({ where: { AND: [this.scope(user, resource), { id }] }, take: 1 });
    if (!rows[0]) throw new NotFoundException();
    return this.projection(resource, rows[0]);
  }
  async issuedTicketInvoices(user: AuthUser, query: Record<string, unknown>) {
    this.spec(user, "tickets");
    const page = typeof query.page === "string" ? Number(query.page) : query.page === undefined ? 1 : NaN;
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw new BadRequestException("Invalid page");

    const status = query.status || "ISSUED";
    if (status !== "ISSUED" && status !== "REFUNDED" && status !== "REISSUED") {
      throw new BadRequestException("Invalid ticket status");
    }
    function search(key: string) {
      const value = query[key];
      if (value === undefined || value === "") return undefined;
      if (typeof value !== "string" || value.length > 100 || value.includes("\0")) {
        throw new BadRequestException("Invalid search");
      }
      const term = value.trim();
      return term ? { contains: term.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" as const } : undefined;
    }
    const reference = search("reference");
    const passenger = search("passenger");
    const customer = search("customer");
    const supplier = search("supplier");
    const peopleScope = customerBranchWhere(user);
    const where: Prisma.TicketSaleWhereInput = {
      ...this.scope(user, "tickets"),
      status,
      ...(!user.isSuperAdmin && { AND: [
        { OR: [{ customerId: null }, { customer: peopleScope }] },
        { OR: [{ passengerId: null }, { passenger: { customer: peopleScope } }] },
      ] }),
      ...(reference && { ticketNumber: reference }),
      ...(passenger && { passenger: { fullName: passenger } }),
      ...(customer && { customer: { fullName: customer } }),
      ...(supplier && { supplier: { name: supplier } }),
    };
    const pageSize = 20;
    const [data, total] = await Promise.all([
      this.prisma.ticketSale.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, ticketNumber: true, createdAt: true, sector: true, departureAt: true,
          net: true, currency: true, status: true,
          passenger: { select: { fullName: true } },
          customer: { select: { fullName: true } },
          supplier: { select: { name: true } },
        },
      }),
      this.prisma.ticketSale.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }
  private async checkLinks(db: PrismaService, user: AuthUser, resource: string, data: Record<string, unknown>, before?: Record<string, unknown>) {
    return validateResourceLinks(db, user, resource, data, before);
  }
  async save(user: AuthUser, resource: string, id: string | null, body: unknown, ip?: string) {
    const contract = this.spec(user, resource);
    if (id ? !contract.canEdit : !contract.canCreate) throw new ForbiddenException("Operation not available");
    const envelope = body as { data?: unknown; version?: unknown };
    if (!envelope || Object.keys(envelope).some(k => !["data", "version"].includes(k))) throw new BadRequestException("Invalid form");
    const data = parseFields(contract.writeFields, envelope.data, !id);
    if (!Object.keys(data).length) throw new BadRequestException("No changes supplied");
    try {
      return await this.prisma.$transaction(async tx => {
        const db = tx as PrismaService;
        const before = id ? await this.detail(user, resource, id, db) : undefined;
        if (before?.version && envelope.version !== before.version) throw new ConflictException("Record changed. Reload before saving.");
        if (resource === "leads" && before && Object.hasOwn(data, "branchId") && data.branchId !== before.branchId && !can(user, "lead.assign")) throw new ForbiddenException("Lead assignment permission is required to change branch");
        await this.checkLinks(db, user, resource, data, before);
        const service = new ResourcesService(db, new SequenceService(db), new AuditService(db));
        const result = id ? await service.update(resource, id, user, data, ip) : await service.create(resource, user, data, ip);
        return this.projection(resource, result as Record<string, unknown>);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2034") throw new ConflictException("Record changed. Reload before saving.");
        if (error.code === "P2002") throw new ConflictException("A record with these unique details already exists.");
        if (["P2003", "P2025"].includes(error.code)) throw new BadRequestException("A selected linked record is unavailable.");
      }
      throw error;
    }
  }
  async assignees(user: AuthUser, leadId: string) {
    if (!can(user, "lead.assign")) throw new ForbiddenException();
    await this.detail(user, "leads", leadId);
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead?.branchId) return [];
    return this.prisma.user.findMany({ where: { status: "ACTIVE", deletedAt: null, OR: [{ defaultBranchId: lead.branchId }, { branches: { some: { branchId: lead.branchId } } }] }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" }, take: 200 });
  }
  async stayRooms(user: AuthUser, id: string) {
    await this.detail(user, "hotel-bookings", id);
    if (!can(user, "hotel.booking")) throw new ForbiddenException();
    return this.prisma.hotelStayRoom.findMany({ where: { segment: { bookingId: id } }, select: { id: true, roomNumber: true, status: true }, orderBy: { createdAt: "asc" }, take: 200 });
  }
  async staffAccess(user: AuthUser, id: string) {
    if (!user.isSuperAdmin) throw new ForbiddenException();
    const target = await this.prisma.user.findUnique({ where: { id }, select: { id: true, fullName: true, status: true, updatedAt: true, defaultBranchId: true, roles: { select: { roleId: true } }, branches: { select: { branchId: true } } } });
    if (!target) throw new NotFoundException();
    const [roles, branches] = await Promise.all([this.prisma.role.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }), this.prisma.branch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })]);
    return { target, roles, branches, statuses: fieldsFor("users").find(f => f.name === "status")?.options ?? [] };
  }
  async saveStaffAccess(user: AuthUser, id: string, body: { roleIds?: unknown; branchIds?: unknown; defaultBranchId?: unknown; status?: unknown; version?: unknown }) {
    return new StaffAccessService(this.prisma).save(user, id, body);
  }

  async createStaff(user: AuthUser, body: Record<string, unknown>) {
    if (!user.isSuperAdmin) throw new ForbiddenException();
    const fields = ["fullName", "username", "email", "password"];
    if (!body || Object.keys(body).some(k => !fields.includes(k)) || fields.some(k => typeof body[k] !== "string")) throw new BadRequestException("Invalid staff account form");
    const username = String(body.username).trim();
    const email = String(body.email).trim().toLowerCase();
    const fullName = String(body.fullName).trim();
    if (!/^[a-z0-9._-]{3,32}$/.test(username) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !fullName || fullName.length > 160) throw new BadRequestException("Invalid staff account details");
    assertPasswordPolicy(String(body.password));
    const passwordHash = await hashPassword(String(body.password));
    return this.prisma.$transaction(async tx => {
      const created = await tx.user.create({ data: { username, email, fullName, passwordHash, status: "INACTIVE" } });
      await new AuditService(tx as PrismaService).log({ userId: user.id, action: "CREATE", entity: "user", entityId: created.id, after: { username, email, status: created.status } });
      return { id: created.id, status: created.status };
    });
  }
  async leadStatus(user: AuthUser, leadId: string, body: { status?: unknown; lostReason?: unknown; version?: unknown }) {
    if (!can(user, "lead.edit")) throw new ForbiddenException();
    const statuses = Prisma.dmmf.datamodel.enums.find(e => e.name === "LeadStatus")!.values.map(v => v.name);
    if (!body || Object.keys(body).some(k => !["status", "lostReason", "version"].includes(k)) || typeof body.status !== "string" || !statuses.includes(body.status)) throw new BadRequestException("Invalid lead status");
    const status = body.status as import("@prisma/client").LeadStatus;
    const reason = typeof body.lostReason === "string" ? body.lostReason.trim() : "";
    if (reason.length > 1000 || (["LOST", "CANCELLED"].includes(status) && !reason)) throw new BadRequestException("A reason is required for lost or cancelled leads");
    return this.prisma.$transaction(async tx => {
      const db = tx as PrismaService;
      const before = await this.detail(user, "leads", leadId, db);
      if (before.version !== body.version) throw new ConflictException("Record changed. Reload before changing status.");
      const lead = await tx.lead.update({ where: { id: leadId }, data: { status, lostReason: ["LOST", "CANCELLED"].includes(status) ? reason : null } });
      await tx.leadNote.create({ data: { leadId, userId: user.id, body: `Status changed to ${status}${reason ? `: ${reason}` : ""}` } });
      await new AuditService(db).log({ userId: user.id, action: "STATUS", entity: "lead", entityId: leadId, before: { status: before.status }, after: { status, lostReason: reason || null } });
      return this.projection("leads", lead);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async assign(user: AuthUser, leadId: string, body: { assignedUserId?: unknown; assignedAgentId?: unknown; version?: unknown }) {
    if (!can(user, "lead.assign")) throw new ForbiddenException();
    if (!body || Object.keys(body).some(k => !["assignedUserId", "assignedAgentId", "version"].includes(k)) || !["assignedUserId", "assignedAgentId"].some(k => Object.hasOwn(body, k))) throw new BadRequestException("Invalid assignment");
    const data: { assignedUserId?: string | null; assignedAgentId?: string | null } = {};
    for (const key of ["assignedUserId", "assignedAgentId"] as const) {
      if (!Object.hasOwn(body, key)) continue;
      const value = body[key];
      if (value !== null && (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(value))) throw new BadRequestException("Invalid assignment");
      data[key] = value as string | null;
    }
    return this.prisma.$transaction(async tx => {
      const db = tx as PrismaService;
      const before = await this.detail(user, "leads", leadId, db);
      if (before.version !== body.version) throw new ConflictException("Record changed. Reload before assigning.");
      await this.checkLinks(db, user, "leads", data, before);
      if (data.assignedAgentId) {
        const agent = await tx.agent.findUnique({ where: { id: data.assignedAgentId } });
        if (!agent || agent.status !== "ACTIVE") throw new BadRequestException("Agent is unavailable");
      }
      const lead = await tx.lead.update({ where: { id: leadId }, data });
      if (data.assignedUserId && data.assignedUserId !== before.assignedUserId) await tx.notification.create({ data: { userId: data.assignedUserId, title: "Lead assigned", body: `${lead.fullName} (${lead.leadNumber}) was assigned to you`, type: "LEAD", meta: { leadId } } });
      await new AuditService(db).log({ userId: user.id, action: "ASSIGN", entity: "lead", entityId: leadId, before: { assignedUserId: before.assignedUserId, assignedAgentId: before.assignedAgentId }, after: { assignedUserId: lead.assignedUserId, assignedAgentId: lead.assignedAgentId } });
      return this.projection("leads", lead);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch(error => {
      if (isSerializationConflict(error)) throw new ConflictException("Record changed. Reload before assigning.");
      throw error;
    });
  }
}
