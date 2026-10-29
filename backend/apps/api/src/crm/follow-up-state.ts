import { Prisma } from "@prisma/client";
import type { PrismaService } from "../common/prisma.service";

type FollowUpDb = Pick<PrismaService, "$queryRaw" | "lead" | "followUp">;
const leadIds = (ids: unknown[]) => [...new Set(ids.filter((id): id is string => typeof id === "string" && !!id))].sort();

/** All follow-up writers lock affected leads in the same order before changing work. */
export async function lockFollowUpLeads(db: FollowUpDb, ids: unknown[]) {
  const selected = leadIds(ids);
  if (selected.length) await db.$queryRaw(Prisma.sql`SELECT id FROM "Lead" WHERE id IN (${Prisma.join(selected)}) ORDER BY id FOR UPDATE`);
}

/** A reminder is the earliest pending follow-up, never the most recently edited one. */
export async function refreshFollowUpLeads(db: FollowUpDb, ids: unknown[]) {
  for (const id of leadIds(ids)) {
    const next = await db.followUp.findFirst({ where: { leadId: id, status: "PENDING" }, orderBy: { dueAt: "asc" }, select: { dueAt: true } });
    await db.lead.update({ where: { id }, data: { nextFollowUpAt: next?.dueAt ?? null } });
  }
}
