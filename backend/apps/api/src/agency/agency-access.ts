import { ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";

export function requireAgencyEnabled() {
  if (process.env.AGENT_PORTAL_ENABLED !== "true") throw new ServiceUnavailableException("Agent access is not activated");
}

/** Stored membership is re-read on every request; client agency IDs grant nothing. */
export async function agencyForUser(db: PrismaService, userId: string) {
  requireAgencyEnabled();
  const membership = await db.agencyMembership.findUnique({ where: { userId }, include: { agent: true, user: { include: { roles: true } } } });
  if (!membership?.active || membership.agent.status !== "ACTIVE" || !membership.agent.branchId || membership.user.roles.length || membership.user.deletedAt || membership.user.status !== "ACTIVE") {
    throw new ForbiddenException("An active external agency membership is required");
  }
  return membership.agent;
}
