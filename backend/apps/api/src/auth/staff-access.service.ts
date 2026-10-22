import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma, UserStatus } from "@prisma/client";
import { AuthUser } from "./auth.types";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";

function accessIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 100 || value.some(v => typeof v !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(v)) || new Set(value).size !== value.length) throw new BadRequestException("Invalid access selection");
  return value;
}

// Both legacy RBAC routes and the staff console use the same transaction owner.
export class StaffAccessService {
  constructor(private prisma: PrismaService) {}

  async save(user: AuthUser, id: string, body: { roleIds?: unknown; branchIds?: unknown; defaultBranchId?: unknown; status?: unknown; version?: unknown }, partial = false) {
    if (!user.isSuperAdmin) throw new ForbiddenException();
    if (!body || Object.keys(body).some(k => !["roleIds", "branchIds", "defaultBranchId", "status", "version"].includes(k))) throw new BadRequestException("Invalid staff access form");
    if (!partial && typeof body.version !== "string") throw new BadRequestException("Staff version is required");
    return this.prisma.$transaction(async tx => {
      const before = await tx.user.findUnique({ where: { id }, include: { roles: { include: { role: true } }, branches: true } });
      if (!before || before.deletedAt) throw new NotFoundException();
      if (body.version !== undefined && before.updatedAt.toISOString() !== body.version) throw new ConflictException("Staff account changed. Reload before saving.");
      const roleIds = accessIds(partial && body.roleIds === undefined ? before.roles.map(r => r.roleId) : body.roleIds);
      const branches = accessIds(partial && body.branchIds === undefined ? before.branches.map(b => b.branchId) : body.branchIds);
      const targetStatus = partial && body.status === undefined ? before.status : body.status;
      if (typeof targetStatus !== "string" || !Object.values(UserStatus).includes(targetStatus as UserStatus)) throw new BadRequestException("Invalid staff status");
      const defaultBranchId = partial && body.defaultBranchId === undefined ? before.defaultBranchId : body.defaultBranchId;
      if (defaultBranchId !== null && (typeof defaultBranchId !== "string" || !branches.includes(defaultBranchId))) throw new BadRequestException("Default branch must be selected");
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
      await tx.user.update({ where: { id }, data: { status: targetStatus as UserStatus, defaultBranchId: defaultBranchId as string | null } });
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await new AuditService(tx as PrismaService).log({ userId: user.id, action: "STAFF_ACCESS", entity: "user", entityId: id, after: { roleIds, branchIds: branches, defaultBranchId, status: targetStatus } });
      return { ok: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async setPermissions(user: AuthUser, id: string, input: unknown) {
    if (!user.isSuperAdmin) throw new ForbiddenException();
    const permissionIds = accessIds(input);
    return this.prisma.$transaction(async tx => {
      if (!await tx.role.findUnique({ where: { id } })) throw new NotFoundException();
      if (await tx.permission.count({ where: { id: { in: permissionIds } } }) !== permissionIds.length) throw new BadRequestException("A selected permission is unavailable");
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      if (permissionIds.length) await tx.rolePermission.createMany({ data: permissionIds.map(permissionId => ({ roleId: id, permissionId })) });
      const users = await tx.userRole.findMany({ where: { roleId: id }, select: { userId: true } });
      await tx.session.updateMany({ where: { userId: { in: users.map(u => u.userId) }, revokedAt: null }, data: { revokedAt: new Date() } });
      await new AuditService(tx as PrismaService).log({ userId: user.id, action: "ROLE_PERMISSIONS", entity: "role", entityId: id, after: { permissionIds } });
      return { ok: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

