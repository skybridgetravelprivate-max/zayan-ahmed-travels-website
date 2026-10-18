import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { SequenceService } from "../common/sequence.service";
import { AuditService } from "../common/audit.service";
import { AuthUser, can } from "../auth/auth.types";
import { RESOURCES, actionPermission } from "./registry";
import { assertPassengerBranch, assertPeopleLinks, assertPeopleLinksInBranch, assertRecordBranch, branchIds, customerBranchWhere } from "../auth/record-scope";
import { authorizeDocumentOwner, authorizeStoredDocument } from "../documents/document-scope";
import { hashPassword, assertPasswordPolicy } from "../common/password";

function redactSecrets(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (Object.getPrototypeOf(value) !== Object.prototype) return value;
  const out: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  delete out.password;
  delete out.passwordHash;
  delete out.refreshTokenHash;
  delete out.tokenHash;
  for (const key of Object.keys(out)) out[key] = redactSecrets(out[key]);
  return out;
}

@Injectable()
export class ResourcesService {
  constructor(
    private prisma: PrismaService,
    private seq: SequenceService,
    private audit: AuditService,
  ) {}

  meta(resource: string) {
    const m = RESOURCES[resource];
    if (!m) throw new NotFoundException("Unknown resource");
    return m;
  }

  delegate(resource: string) {
    const m = this.meta(resource);
    const d = (this.prisma as unknown as Record<string, unknown>)[m.model] as {
      findMany: (args?: unknown) => Promise<Record<string, unknown>[]>;
      findUnique: (args?: unknown) => Promise<Record<string, unknown> | null>;
      count: (args?: unknown) => Promise<number>;
      create: (args?: unknown) => Promise<Record<string, unknown>>;
      update: (args?: unknown) => Promise<Record<string, unknown>>;
      delete: (args?: unknown) => Promise<Record<string, unknown>>;
    };
    if (!d) throw new NotFoundException("Model missing");
    return d;
  }

  private assert(user: AuthUser, resource: string, action: "view" | "create" | "edit" | "delete") {
    if (resource === "tickets" && (action === "edit" || action === "delete")) throw new ForbiddenException("Use the transactional ticket workflows");
    if (resource === "documents" && action !== "view") throw new ForbiddenException("Use the authorized document upload endpoint");
    if (resource === "audit-logs" && action !== "view") throw new ForbiddenException("Audit records are read-only");
    if (["journals", "receipts", "payments", "expenses", "ticket-refunds"].includes(resource) && action !== "view") throw new ForbiddenException("Use the transactional finance endpoints");
    if (["roles", "users"].includes(resource) && action !== "view" && !user.isSuperAdmin) throw new ForbiddenException("Only super administrators may modify roles");
    const perm = actionPermission(this.meta(resource), action);
    if (!can(user, perm) && !can(user, `${this.meta(resource).permission}.${action}`)) {
      if (perm === "user.manage" && can(user, "user.manage")) return;
      if (!can(user, perm)) throw new ForbiddenException(perm);
    }
  }

  private allowedBranchIds(user: AuthUser) {
    if (user.isSuperAdmin) return null;
    const ids = [...user.branchIds];
    if (user.defaultBranchId && !ids.includes(user.defaultBranchId)) ids.push(user.defaultBranchId);
    return ids;
  }

  private branchWhere(user: AuthUser, meta: ReturnType<ResourcesService["meta"]>, extra: Record<string, unknown> = {}) {
    if (meta.model === "customer" && !user.isSuperAdmin) return { ...extra, ...customerBranchWhere(user) };
    if (meta.model === "passenger" && !user.isSuperAdmin) return { ...extra, customer: customerBranchWhere(user) };
    if (!user.isSuperAdmin && meta.model === "passengerDocument") return { ...extra, passenger: { customer: customerBranchWhere(user) } };
    if (!user.isSuperAdmin && meta.model === "ticketRefund") return { ...extra, ticket: { branchId: { in: branchIds(user) } } };
    if (!meta.branchField || user.isSuperAdmin) return extra;
    const ids = this.allowedBranchIds(user);
    if (!ids || ids.length === 0) {
      extra[meta.branchField] = { in: ["__none__"] };
      return extra;
    }
    extra[meta.branchField] = { in: ids };
    return extra;
  }

  private async assertRowBranch(user: AuthUser, meta: ReturnType<ResourcesService["meta"]>, row: Record<string, unknown>) {
    if (meta.model === "storedDocument") await authorizeStoredDocument(this.prisma, user, row);
    if (meta.model === "passengerDocument") await assertRecordBranch(this.prisma, user, "passenger", row.passengerId);
    if (meta.model === "ticketRefund") await assertRecordBranch(this.prisma, user, "ticketSale", row.ticketId);
    if (meta.model === "customer" && row.leadId) await assertRecordBranch(this.prisma, user, "lead", row.leadId);
    if (meta.model === "passenger") await assertPassengerBranch(this.prisma, user, row.customerId);
    if (!meta.branchField || user.isSuperAdmin) return;
    const ids = this.allowedBranchIds(user) ?? [];
    const bid = row[meta.branchField];
    if (typeof bid !== "string" || !ids.includes(bid)) throw new NotFoundException();
  }

  async list(resource: string, user: AuthUser, query: Record<string, string>) {
    this.assert(user, resource, "view");
    const meta = this.meta(resource);
    if (resource === "documents" && !user.isSuperAdmin) {
      if (!query.entityType || !query.entityId) throw new ForbiddenException("Select an authorized document owner");
      await authorizeDocumentOwner(this.prisma, user, query.entityType, query.entityId);
    }
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)));
    const where: Record<string, unknown> = this.branchWhere(user, meta);
    if (query.status) where.status = query.status;
    if (query.branchId && meta.branchField) {
      const ids = this.allowedBranchIds(user);
      if (ids && !ids.includes(query.branchId)) throw new ForbiddenException();
      where[meta.branchField] = query.branchId;
    }
    if (query.q && meta.search?.length) {
      where.OR = meta.search.map((f) => ({ [f]: { contains: query.q, mode: "insensitive" } }));
    }
    const blocked = new Set(["page", "pageSize", "q", "sort", "dir", "password", "passwordHash", "OR", "AND", "NOT"]);
    for (const [k, v] of Object.entries(query)) {
      if (blocked.has(k) || v === undefined || v === "") continue;
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(k)) continue;
      if (where[k] === undefined) where[k] = v;
    }
    const sortRaw = query.sort ?? meta.defaultSort ?? "createdAt";
    const sort = /^[a-zA-Z][a-zA-Z0-9_]*$/.test(sortRaw) ? sortRaw : "createdAt";
    const dir = query.dir === "asc" ? "asc" : "desc";
    const d = this.delegate(resource);
    const [data, total] = await Promise.all([
      d.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sort]: dir },
      }),
      d.count({ where }),
    ]);
    const sanitized = resource === "users" ? data.map((u) => ({ ...u, passwordHash: undefined })) : data;
    return { data: redactSecrets(sanitized), total, page, pageSize };
  }

  async get(resource: string, id: string, user: AuthUser) {
    this.assert(user, resource, "view");
    const meta = this.meta(resource);
    const include =
      resource === "leads"
        ? { assignedUser: true, assignedAgent: true, followUps: true, quotations: { where: this.branchWhere(user, this.meta("quotations")) } }
        : resource === "customers"
          ? { quotations: { where: this.branchWhere(user, this.meta("quotations")) }, umrahBookings: { where: this.branchWhere(user, this.meta("umrah-bookings")) }, tickets: { where: this.branchWhere(user, this.meta("tickets")) } }
          : undefined;
    const row = await this.delegate(resource).findUnique({
      where: { id },
      ...(include ? { include } : {}),
    });
    if (!row) throw new NotFoundException();
    await this.assertRowBranch(user, meta, row as Record<string, unknown>);
    if (resource === "users") delete (row as { passwordHash?: string }).passwordHash;
    return redactSecrets(row);
  }

  async create(resource: string, user: AuthUser, body: Record<string, unknown>, ip?: string) {
    this.assert(user, resource, "create");
    const meta = this.meta(resource);
    const data = this.sanitize(body, true);
    delete data.id;
    if (meta.number && !data[meta.number.field]) {
      data[meta.number.field] = await this.seq.next(meta.number.key, meta.number.prefix);
    }
    if (resource === "users") {
      if (typeof data.password !== "string") throw new BadRequestException("password required");
      assertPasswordPolicy(data.password as string);
      data.passwordHash = await hashPassword(data.password as string);
      delete data.password;
    }
    if (meta.branchField && !data[meta.branchField] && user.defaultBranchId) {
      data[meta.branchField] = user.defaultBranchId;
    }
    const allowed = this.allowedBranchIds(user);
    if (meta.branchField && allowed) {
      const bid = data[meta.branchField];
      if (typeof bid !== "string" || !allowed.includes(bid)) throw new ForbiddenException();
    }
    if (resource === "quotations") {
      const selling = Number(data.sellingTotal ?? 0);
      const discount = Number(data.discount ?? 0);
      const tax = Number(data.tax ?? 0);
      data.net = selling - discount + tax;
    }
    if (resource === "umrah-bookings") {
      const selling = Number(data.sellingPrice ?? 0);
      const discount = Number(data.discount ?? 0);
      const tax = Number(data.tax ?? 0);
      const cost = Number(data.cost ?? 0);
      const paid = Number(data.paid ?? 0);
      data.net = selling - discount + tax;
      data.balance = Number(data.net) - paid;
      data.profit = Number(data.net) - cost;
    }
    await assertPeopleLinks(this.prisma, user, data);
    if (resource === "complaints") await assertPeopleLinksInBranch(this.prisma, data, data.branchId);
    if (data.leadId) await assertRecordBranch(this.prisma, user, "lead", data.leadId);
    if (data.quotationId) await assertRecordBranch(this.prisma, user, "quotation", data.quotationId);
    if (resource === "passengers") await assertPassengerBranch(this.prisma, user, data.customerId);
    if (resource === "passenger-documents" && data.documentId) {
      const doc = await this.prisma.storedDocument.findUnique({ where: { id: String(data.documentId) } });
      if (!doc) throw new NotFoundException();
      await authorizeStoredDocument(this.prisma, user, doc);
    }
    const created = await this.delegate(resource).create({ data });
    await this.audit.log({
      userId: user.id,
      action: "CREATE",
      entity: meta.model,
      entityId: String(created.id),
      after: redactSecrets(created),
      ipAddress: ip,
    });
    if (resource === "users") delete (created as { passwordHash?: string }).passwordHash;
    return created;
  }

  async update(resource: string, id: string, user: AuthUser, body: Record<string, unknown>, ip?: string) {
    this.assert(user, resource, "edit");
    const meta = this.meta(resource);
    const before = await this.delegate(resource).findUnique({ where: { id } });
    if (!before) throw new NotFoundException();
    await this.assertRowBranch(user, meta, before as Record<string, unknown>);
    if (resource === "hotel-bookings" && await this.prisma.journalEntry.findFirst({ where: { module: "reservation", sourceId: id, status: "POSTED" } })) throw new ForbiddenException("Use the reservation workflow for posted bookings");
    const data = this.sanitize(body, false);
    if (meta.branchField && Object.hasOwn(data, meta.branchField)) {
      await this.assertRowBranch(user, meta, data);
    }
    delete data.id;
    meta.omitOnWrite?.forEach((k) => delete data[k]);
    delete data.passwordHash;
    if (resource === "users" && typeof data.password === "string" && data.password) {
      assertPasswordPolicy(data.password as string);
      data.passwordHash = await hashPassword(data.password as string);
      delete data.password;
    }
    await assertPeopleLinks(this.prisma, user, data);
    if (resource === "complaints") {
      await assertPeopleLinksInBranch(
        this.prisma,
        {
          customerId: Object.hasOwn(data, "customerId") ? data.customerId : before.customerId,
          passengerId: Object.hasOwn(data, "passengerId") ? data.passengerId : before.passengerId,
        },
        Object.hasOwn(data, "branchId") ? data.branchId : before.branchId,
      );
    }
    if (data.leadId) await assertRecordBranch(this.prisma, user, "lead", data.leadId);
    if (data.quotationId) await assertRecordBranch(this.prisma, user, "quotation", data.quotationId);
    if (resource === "passengers" && Object.hasOwn(data, "customerId")) await assertPassengerBranch(this.prisma, user, data.customerId);
    if (resource === "passenger-documents" && data.documentId) {
      const doc = await this.prisma.storedDocument.findUnique({ where: { id: String(data.documentId) } });
      if (!doc) throw new NotFoundException();
      await authorizeStoredDocument(this.prisma, user, doc);
    }
    const updated = await this.delegate(resource).update({ where: { id }, data });
    await this.audit.log({
      userId: user.id,
      action: "UPDATE",
      entity: meta.model,
      entityId: id,
      before: redactSecrets(before),
      after: redactSecrets(updated),
      ipAddress: ip,
    });
    if (resource === "users") delete (updated as { passwordHash?: string }).passwordHash;
    return redactSecrets(updated);
  }

  async remove(resource: string, id: string, user: AuthUser, ip?: string) {
    this.assert(user, resource, "delete");
    const meta = this.meta(resource);
    const before = await this.delegate(resource).findUnique({ where: { id } });
    if (!before) throw new NotFoundException();
    await this.assertRowBranch(user, meta, before as Record<string, unknown>);
    if (resource === "hotel-bookings" && await this.prisma.journalEntry.findFirst({ where: { module: "reservation", sourceId: id, status: "POSTED" } })) throw new ForbiddenException("Use the reservation workflow for posted bookings");
    await this.delegate(resource).delete({ where: { id } });
    await this.audit.log({
      userId: user.id,
      action: "DELETE",
      entity: meta.model,
      entityId: id,
      before: redactSecrets(before),
      ipAddress: ip,
    });
    return { ok: true };
  }

  private sanitize(body: Record<string, unknown>, nestedCreate: boolean) {
    const data: Record<string, unknown> = { ...body };
    delete data.passwordHash;
    delete data.refreshTokenHash;
    delete data.tokenHash;
    const nestedOk = new Set(nestedCreate ? ["items", "lines", "components"] : []);
    for (const [k, v] of Object.entries(data)) {
      if (v === "") data[k] = null;
      else if (v === "true") data[k] = true;
      else if (v === "false") data[k] = false;
      else if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) data[k] = new Date(v);
      else if (v && typeof v === "object" && !(v instanceof Date)) {
        if (nestedOk.has(k) && Array.isArray(v)) {
          data[k] = {
            create: (v as Record<string, unknown>[]).map((row) => {
              if (!row || typeof row !== "object") return {};
              const clean: Record<string, unknown> = { ...row };
              delete clean.id;
              return clean;
            }),
          };
        } else {
          delete data[k];
        }
      }
    }
    return data;
  }

  async bulk(resource: string, user: AuthUser, ids: string[], action: string) {
    if (!Array.isArray(ids) || ids.length > 100 || ids.some(id => typeof id !== "string")) throw new BadRequestException("Invalid record ids");
    if (action !== "delete" && !(action === "archive" && resource === "leads")) throw new BadRequestException("Unsupported bulk action");
    if (action === "delete") {
      for (const id of ids) await this.remove(resource, id, user);
    }
    if (action === "archive" && resource === "leads") {
      this.assert(user, resource, "edit");
      const result = await this.prisma.lead.updateMany({ where: this.branchWhere(user, this.meta(resource), { id: { in: ids } }), data: { archivedAt: new Date() } });
      await this.audit.log({ userId: user.id, action: "ARCHIVE", entity: "Lead", after: { count: result.count } });
      return { ok: true, count: result.count };
    }
    return { ok: true, count: ids.length };
  }
}
