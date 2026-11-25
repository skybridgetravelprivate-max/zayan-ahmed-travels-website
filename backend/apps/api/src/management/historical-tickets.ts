import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthUser } from "../auth/auth.types";
import type { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";

const object = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (v: unknown, limit = 300) => typeof v === "string" ? v.slice(0, limit) : "";
const hash = /^[a-f0-9]{64}$/;
function authorize(user: AuthUser) {
  // Legacy source imports have no verified branch owner. Never expose them to scoped roles.
  if (!user.isSuperAdmin) throw new ForbiddenException("Historical supplier records require Super Admin access");
}

export async function historicalTickets(db: PrismaService, user: AuthUser, cursor?: string) {
  authorize(user);
  if (cursor !== undefined && !/^[A-Za-z0-9_-]{1,80}$/.test(cursor)) throw new BadRequestException("Invalid cursor");
  const rows = await db.pnrRecord.findMany({
    where: { rawData: { path: ["historicalSupplierStatements"], not: Prisma.AnyNull }, ...(cursor ? { id: { gt: cursor } } : {}) },
    orderBy: { id: "asc" }, take: 51,
    select: { id: true, pnr: true, updatedAt: true, rawData: true },
  });
  return {
    groups: rows.slice(0, 50).map(row => {
      const raw = object(row.rawData);
      const reviews = object(raw.historicalSupplierReviews);
      return { id: row.id, pnr: row.pnr, version: row.updatedAt.toISOString(), statements:
        Object.entries(object(raw.historicalSupplierStatements)).filter(([key]) => hash.test(key)).map(([key, value]) => {
          const source = object(value);
          return { sourceHash: key, supplier: text(source.supplier), currency: text(source.currency, 3),
            total: text(source.statement_total, 30), note: text(object(reviews[key]).note, 2000),
            tickets: (Array.isArray(source.tickets) ? source.tickets : []).slice(0, 500).map(value => {
              const t = object(value);
              return { ticketNumber: text(t.ticket_number, 30), passenger: text(t.passenger), sector: text(t.sector),
                invoice: text(t.invoice), invoiceDate: text(t.invoice_date, 40), amount: text(t.statement_amount, 30) };
            }),
          };
        }),
      };
    }),
    nextCursor: rows.length > 50 ? rows[49].id : null,
  };
}

export async function reviewHistoricalTickets(db: PrismaService, user: AuthUser, id: string, input: unknown) {
  authorize(user);
  const body = object(input);
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) || Object.keys(body).some(key => !["sourceHash", "version", "note", "reason"].includes(key)) ||
    typeof body.sourceHash !== "string" || !hash.test(body.sourceHash) || typeof body.version !== "string" ||
    !Number.isFinite(Date.parse(body.version)) || typeof body.note !== "string" || body.note.length > 2000 ||
    typeof body.reason !== "string" || !body.reason.trim() || body.reason.length > 500) throw new BadRequestException("Invalid review");
  const { sourceHash, version, note, reason } = body as { sourceHash: string; version: string; note: string; reason: string };
  return db.$transaction(async tx => {
    const row = await tx.pnrRecord.findUnique({ where: { id } });
    if (!row || !Object.hasOwn(object(object(row.rawData).historicalSupplierStatements), sourceHash)) throw new NotFoundException();
    if (row.updatedAt.toISOString() !== version) throw new ConflictException("Record changed. Reload before saving.");
    const raw = object(row.rawData), reviews = object(raw.historicalSupplierReviews);
    const previous = object(reviews[sourceHash]);
    const next = { ...raw, historicalSupplierReviews: { ...reviews, [sourceHash]: { note, reviewedAt: new Date().toISOString() } } };
    const saved = await tx.pnrRecord.updateMany({ where: { id, updatedAt: row.updatedAt }, data: {
      rawData: next as Prisma.InputJsonObject,
      updatedAt: new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1)),
    } });
    if (saved.count !== 1) throw new ConflictException("Record changed. Reload before saving.");
    await new AuditService(db).log({ db: tx, userId: user.id, action: "REVIEW_HISTORICAL_TICKETS", entity: "PnrRecord", entityId: id,
      before: { sourceHash, note: text(previous.note, 2000) }, after: { sourceHash, note }, reason: reason.trim() });
    return { saved: true };
  });
}
