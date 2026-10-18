import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { AuthUser, can } from "./auth.types";
import { PrismaService } from "../common/prisma.service";
export function branchIds(user: AuthUser) {
  return [...new Set([...user.branchIds, ...(user.defaultBranchId ? [user.defaultBranchId] : [])])];
}
export function assertBranch(user: AuthUser, branchId: unknown) {
  if (!user.isSuperAdmin && (typeof branchId !== "string" || !branchIds(user).includes(branchId))) throw new NotFoundException();
}
export function requirePermission(user: AuthUser, permission: string) {
  if (!can(user, permission)) throw new ForbiddenException(permission);
}
export async function assertPassengerBranch(db: PrismaService, user: AuthUser, customerId: unknown) {
  if (user.isSuperAdmin) return;
  if (typeof customerId !== "string" || !customerId) throw new NotFoundException();
  const customer = await db.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new NotFoundException();
  assertBranch(user, customer.branchId);
}
