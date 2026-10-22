import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { AuthUser } from "../auth/auth.types";
import { branchIds, customerBranchWhere, assertPeopleLinksInBranch, assertRecordBranch } from "../auth/record-scope";
import { PrismaService } from "../common/prisma.service";
import { RESOURCES } from "./registry";

// All operational resources need an explicit owner projection. Unknown ones fail closed.
export function resourceScope(user: AuthUser, resource: string): Record<string, unknown> {
  if (user.isSuperAdmin) return {};
  const branch = { branchId: { in: branchIds(user) } };
  if (resource === "customers") return customerBranchWhere(user);
  if (resource === "passengers") return { customer: customerBranchWhere(user) };
  if (resource === "passenger-documents") return { passenger: { customer: customerBranchWhere(user) } };
  if (["tasks", "follow-ups"].includes(resource)) return {
    AND: [
      { OR: [{ leadId: null }, { lead: branch }] },
      { OR: [{ customerId: null }, { customer: customerBranchWhere(user) }] },
      { OR: [{ lead: branch }, { customer: customerBranchWhere(user) }, { assignedUserId: user.id }] },
    ],
  };
  if (["ticket-refunds", "ticket-reissues"].includes(resource)) return { [resource === "ticket-refunds" ? "ticket" : "originalTicket"]: branch };
  if (resource === "notifications") return { userId: user.id };
  if (RESOURCES[resource]?.branchField) return branch;
  // These records are shared master data rather than branch-owned operations.
  const global = ["agents", "suppliers", "hotels", "hotel-rooms", "hotel-physical-rooms", "airlines", "airports", "vehicles", "drivers", "umrah-packages", "ziyarat", "ticket-groups", "pnr"];
  if (!global.includes(resource)) throw new ForbiddenException("This module requires administrator access");
  return {};
}

export async function validateResourceLinks(db: PrismaService, user: AuthUser, resource: string, data: Record<string, unknown>, before?: Record<string, unknown>) {
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
    if (["tasks", "follow-ups"].includes(resource) && !user.isSuperAdmin && !merged.leadId && !merged.customerId && (!before || merged.assignedUserId !== user.id)) throw new BadRequestException("Select an authorized lead or customer");
    const start = merged.travelDate ?? merged.departureDate ?? merged.checkIn;
    const end = merged.returnDate ?? merged.checkOut;
    if (start && end && new Date(String(end)) < new Date(String(start))) throw new BadRequestException("End date must not precede start date");
}

