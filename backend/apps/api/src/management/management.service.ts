import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthUser, can } from "../auth/auth.types";
import { branchIds, customerBranchWhere, assertPeopleLinksInBranch, assertRecordBranch } from "../auth/record-scope";
import { AuditService } from "../common/audit.service";
import { PrismaService } from "../common/prisma.service";
import { SequenceService } from "../common/sequence.service";
import { ResourcesService } from "../resources/resources.service";
import { RESOURCES } from "../resources/registry";
import { assertPasswordPolicy, hashPassword } from "../common/password";
import { allowedModule, fieldsFor, MANAGEMENT, ManagementField, modelFor, moduleContract } from "./management.catalog";

export function parseFields(fields: ManagementField[], value: unknown, create: boolean) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequestException("Invalid form");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !fields.some(f => f.name === key))) throw new BadRequestException("Unsupported field");
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    let v = input[f.name];
    if (v === undefined) { if (create && f.required) throw new BadRequestException(`${f.label} is required`); continue; }
    if (v === null || v === "") {
      if (!f.nullable) { if (create && !f.required) continue; throw new BadRequestException(`${f.label} is required`); }
      out[f.name] = null; continue;
    }
    if (f.type === "Boolean") {
      if (typeof v !== "boolean") throw new BadRequestException(`Invalid ${f.label}`);
    } else if (["Int", "Float", "Decimal"].includes(f.type)) {
      if (typeof v !== "string" && typeof v !== "number") throw new BadRequestException(`Invalid ${f.label}`);
      if (typeof v === "string" && !/^-?\d+(?:\.\d{1,6})?$/.test(v)) throw new BadRequestException(`Invalid ${f.label}`);
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 1e12 || (f.type === "Int" && !Number.isSafeInteger(n))) throw new BadRequestException(`Invalid ${f.label}`);
      v = f.type === "Decimal" ? String(v) : n;
    } else {
      if (typeof v !== "string") throw new BadRequestException(`Invalid ${f.label}`);
      const text = v.trim();
      if (!text || text.length > (/[Nn]otes|description|body|terms/.test(f.name) ? 10000 : 300) || /\u0000/.test(text)) throw new BadRequestException(`Invalid ${f.label}`);
      if (f.options && !f.options.includes(text)) throw new BadRequestException(`Invalid ${f.label}`);
      if (f.reference && !/^[A-Za-z0-9_-]{1,80}$/.test(text)) throw new BadRequestException(`Invalid ${f.label}`);
      if (/email/i.test(f.name) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) throw new BadRequestException("Invalid email");
      v = text;
      if (f.type === "DateTime") {
        if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(text) || Number.isNaN(Date.parse(text))) throw new BadRequestException(`Invalid ${f.label}`);
        if (new Date(`${text.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== text.slice(0, 10)) throw new BadRequestException(`Invalid ${f.label}`);
        v = new Date(text.includes("T") && !/(Z|[+-]\d{2}:\d{2})$/.test(text) ? `${text}Z` : text);
      }
    }
    out[f.name] = v;
  }
  return out;
}

/** A constrained staff console over the existing resource/domain services. */
@Injectable()
export class ManagementService {
  constructor(private prisma: PrismaService, private seq: SequenceService) {}

  catalog(user: AuthUser) {
    return Object.keys(MANAGEMENT).filter(key => allowedModule(user, key)).map(key => moduleContract(user, key));
  }
  async options(user: AuthUser, resource: string, q = "") {
    if (q.length > 100) throw new BadRequestException("Invalid search");
    if (resource === "branches") {
      const where = { ...(!user.isSuperAdmin ? { id: { in: branchIds(user) } } : {}), ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}) };
      return { data: await this.prisma.branch.findMany({ where, select: { id: true, name: true }, take: 20, orderBy: { name: "asc" } }) };
    }
    if (resource !== "users" || !["lead.assign", "task.edit", "task.create", "followup.edit", "followup.create"].some(p => can(user, p))) throw new ForbiddenException();
    const where = { status: "ACTIVE" as const, deletedAt: null, ...(!user.isSuperAdmin ? { OR: [{ defaultBranchId: { in: branchIds(user) } }, { branches: { some: { branchId: { in: branchIds(user) } } } }] } : {}), ...(q ? { fullName: { contains: q, mode: "insensitive" as const } } : {}) };
    return { data: await this.prisma.user.findMany({ where, select: { id: true, fullName: true }, take: 20, orderBy: { fullName: "asc" } }) };
  }
  private spec(user: AuthUser, key: string) {
    if (!allowedModule(user, key)) throw new ForbiddenException("Module access denied");
    return moduleContract(user, key);
  }
  private delegate(db: PrismaService, resource: string) {
    return new ResourcesService(db, this.seq, new AuditService(db)).delegate(resource);
  }
  scope(user: AuthUser, resource: string): Record<string, unknown> {
    if (user.isSuperAdmin) return {};
    const branch = { branchId: { in: branchIds(user) } };
    if (resource === "customers") return customerBranchWhere(user);
    if (resource === "passengers") return { customer: customerBranchWhere(user) };
    if (["tasks", "follow-ups"].includes(resource)) return {
      AND: [
        { OR: [{ leadId: null }, { lead: branch }] },
        { OR: [{ customerId: null }, { customer: customerBranchWhere(user) }] },
        { OR: [{ lead: branch }, { customer: customerBranchWhere(user) }, { assignedUserId: user.id }] },
      ],
    };
    if (["ticket-refunds", "ticket-reissues"].includes(resource)) return { [resource === "ticket-refunds" ? "ticket" : "originalTicket"]: branch };
    if (resource === "notifications") return { userId: user.id };
    if (RESOURCES[resource].branchField) return branch;
    // Master data is global. Other operational resources require a branch-safe
    // relation projection before they can be made available to branch staff.
    const global = ["agents", "suppliers", "hotels", "hotel-rooms", "hotel-physical-rooms", "airlines", "airports", "vehicles", "drivers", "umrah-packages", "ziyarat", "ticket-groups", "pnr"];
    if (!global.includes(resource)) throw new ForbiddenException("This module requires administrator access");
    return {};
  }
  private projection(resource: string, row: Record<string, unknown>) {
    const out: Record<string, unknown> = { id: row.id };
    for (const f of fieldsFor(resource)) out[f.name] = row[f.name] ?? null;
    out.version = row.updatedAt instanceof Date ? row.updatedAt.toISOString() : null;
    return out;
  }
  async list(user: AuthUser, resource: string, query: Record<string, string>) {
    this.spec(user, resource);
    const page = Number(query.page ?? 1);
    const q = query.q?.trim() ?? "";
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000 || q.length > 100) throw new BadRequestException("Invalid search");
    const where = this.scope(user, resource);
    const search = (RESOURCES[resource].search ?? []).filter(k => fieldsFor(resource).some(f => f.name === k));
    if (q && search.length) where.OR = search.map(k => ({ [k]: { contains: q, mode: "insensitive" } }));
    const select = Object.fromEntries(["id", ...fieldsFor(resource).map(f => f.name), ...(modelFor(resource)?.fields.some(f => f.name === "updatedAt") ? ["updatedAt"] : [])].map(k => [k, true]));
    const sort = modelFor(resource)?.fields.some(f => f.name === "createdAt") ? "createdAt" : "id";
    const db = this.delegate(this.prisma, resource);
    const [rows, total] = await Promise.all([db.findMany({ where, select, orderBy: { [sort]: "desc" }, skip: (page - 1) * 20, take: 20 }), db.count({ where })]);
    return { data: rows.map(r => this.projection(resource, r)), total, page, pageSize: 20 };
  }
  async detail(user: AuthUser, resource: string, id: string, db = this.prisma) {
    this.spec(user, resource);
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new NotFoundException();
    const rows = await this.delegate(db, resource).findMany({ where: { AND: [this.scope(user, resource), { id }] }, take: 1 });
    if (!rows[0]) throw new NotFoundException();
    return this.projection(resource, rows[0]);
  }
  private async checkLinks(db: PrismaService, user: AuthUser, resource: string, data: Record<string, unknown>, before?: Record<string, unknown>) {
    const merged = { ...before, ...data };
    const recordBranch = merged.branchId || (!before && RESOURCES[resource].branchField ? user.defaultBranchId : null);
    if (recordBranch) await assertPeopleLinksInBranch(db, merged, recordBranch);
    for (const field of ["leadId", "customerId", "passengerId"] as const) if (merged[field]) {
      await assertRecordBranch(db, user, field === "leadId" ? "lead" : field === "customerId" ? "customer" : "passenger", merged[field]);
    }
    if (merged.assignedUserId) {
      const assignee = await db.user.findUnique({ where: { id: String(merged.assignedUserId) }, include: { branches: true } });
      if (!assignee || assignee.status !== "ACTIVE" || assignee.deletedAt) throw new BadRequestException("Assignee is unavailable");
      let branchId = merged.branchId;
      if (!branchId && merged.leadId) branchId = (await db.lead.findUnique({ where: { id: String(merged.leadId) } }))?.branchId;
      if (!branchId && merged.customerId) branchId = (await db.customer.findUnique({ where: { id: String(merged.customerId) } }))?.branchId;
      if (!branchId || (assignee.defaultBranchId !== branchId && !assignee.branches.some(b => b.branchId === branchId))) throw new BadRequestException("Assignee must belong to the record branch");
    }
    if (["tasks", "follow-ups"].includes(resource) && !user.isSuperAdmin && !merged.leadId && !merged.customerId) throw new BadRequestException("Select an authorized lead or customer");
    const start = merged.travelDate ?? merged.departureDate ?? merged.checkIn;
    const end = merged.returnDate ?? merged.checkOut;
    if (start && end && new Date(String(end)) < new Date(String(start))) throw new BadRequestException("End date must not precede start date");
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
    if (!user.isSuperAdmin) throw new ForbiddenException();
    if (!body || Object.keys(body).some(k => !["roleIds", "branchIds", "defaultBranchId", "status", "version"].includes(k))) throw new BadRequestException("Invalid staff access form");
    const ids = (value: unknown) => {
      if (!Array.isArray(value) || value.length > 100 || value.some(v => typeof v !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(v)) || new Set(value).size !== value.length) throw new BadRequestException("Invalid access selection");
      return value as string[];
    };
    const roleIds = ids(body.roleIds);
    const branches = ids(body.branchIds);
    const status = fieldsFor("users").find(f => f.name === "status");
    if (typeof body.status !== "string" || !status?.options?.includes(body.status)) throw new BadRequestException("Invalid staff status");
    const targetStatus = body.status as import("@prisma/client").UserStatus;
    const defaultBranchId = body.defaultBranchId === null ? null : body.defaultBranchId;
    if (defaultBranchId !== null && (typeof defaultBranchId !== "string" || !branches.includes(defaultBranchId))) throw new BadRequestException("Default branch must be selected");
    return this.prisma.$transaction(async tx => {
      const before = await tx.user.findUnique({ where: { id }, include: { roles: { include: { role: true } }, branches: true } });
      if (!before || before.deletedAt) throw new NotFoundException();
      if (before.updatedAt.toISOString() !== body.version) throw new ConflictException("Staff account changed. Reload before saving.");
      const roles = await tx.role.findMany({ where: { id: { in: roleIds } } });
      if (roles.length !== roleIds.length || await tx.branch.count({ where: { id: { in: branches } } }) !== branches.length) throw new BadRequestException("A selected role or branch is unavailable");
      const superNames = ["SUPER_ADMIN", "Super Admin"];
      const retainsAdmin = targetStatus === "ACTIVE" && roles.some(r => superNames.includes(r.name));
      if (id === user.id && !retainsAdmin) throw new BadRequestException("You cannot remove your own active administrator access");
      if (before.roles.some(r => superNames.includes(r.role.name)) && !retainsAdmin) {
        const remaining = await tx.user.count({ where: { id: { not: id }, status: "ACTIVE", deletedAt: null, roles: { some: { role: { name: { in: superNames } } } } } });
        if (!remaining) throw new BadRequestException("At least one active administrator must remain");
      }
      await tx.userRole.deleteMany({ where: { userId: id } });
      if (roleIds.length) await tx.userRole.createMany({ data: roleIds.map(roleId => ({ roleId, userId: id })) });
      await tx.userBranch.deleteMany({ where: { userId: id } });
      if (branches.length) await tx.userBranch.createMany({ data: branches.map(branchId => ({ branchId, userId: id })) });
      await tx.user.update({ where: { id }, data: { status: targetStatus, defaultBranchId: defaultBranchId as string | null } });
      // Permission changes invalidate existing sessions instead of retaining an
      // old browser session after an administrator changes its scope.
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await new AuditService(tx as PrismaService).log({ userId: user.id, action: "STAFF_ACCESS", entity: "user", entityId: id, after: { roleIds, branchIds: branches, defaultBranchId, status: targetStatus } });
      return { ok: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
  async assign(user: AuthUser, leadId: string, body: { assignedUserId?: unknown; version?: unknown }) {
    if (!can(user, "lead.assign")) throw new ForbiddenException();
    if (!body || Object.keys(body).some(k => !["assignedUserId", "version"].includes(k)) || (body.assignedUserId !== null && (typeof body.assignedUserId !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(body.assignedUserId)))) throw new BadRequestException("Invalid assignment");
    return this.prisma.$transaction(async tx => {
      const db = tx as PrismaService;
      const before = await this.detail(user, "leads", leadId, db);
      if (before.version !== body.version) throw new ConflictException("Record changed. Reload before assigning.");
      await this.checkLinks(db, user, "leads", { assignedUserId: body.assignedUserId }, before);
      const lead = await tx.lead.update({ where: { id: leadId }, data: { assignedUserId: body.assignedUserId as string | null } });
      await new AuditService(db).log({ userId: user.id, action: "ASSIGN", entity: "lead", entityId: leadId, before: { assignedUserId: before.assignedUserId }, after: { assignedUserId: lead.assignedUserId } });
      return this.projection("leads", lead);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
