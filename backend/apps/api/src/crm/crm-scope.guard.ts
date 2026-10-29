import { resourceScope } from "../resources/resource-scope";
import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import type { AuthUser } from "../auth/auth.types";

/** Protect every dedicated CRM record route, including child-record writes. */
@Injectable()
export class CrmScopeGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser;
    if (user.isSuperAdmin) return true;
    const ids = [...new Set([...user.branchIds, ...(user.defaultBranchId ? [user.defaultBranchId] : [])])];
    const branch = { branchId: { in: ids } };
    const body = req.body ?? {};
    if (Object.hasOwn(body, "branchId") && !ids.includes(body.branchId)) throw new ForbiddenException();
    const check = async (kind: string, id: unknown): Promise<void> => {
      if (typeof id !== "string" || !id) throw new BadRequestException("Invalid record id");
      let row: { id: string; leadId?: string | null } | null | undefined;
      if (kind === "leads") row = await this.prisma.lead.findFirst({ where: { id, ...branch }, select: { id: true } });
      else if (kind === "customers") row = await this.prisma.customer.findFirst({ where: { id, ...resourceScope(user, "customers") }, select: { id: true, leadId: true } });
      else if (kind === "quotations") row = await this.prisma.quotation.findFirst({ where: { id, ...branch }, select: { id: true } });
      else if (kind === "follow-ups") row = await this.prisma.followUp.findFirst({ where: { id, ...resourceScope(user, "follow-ups") }, select: { id: true } });
      else if (kind === "tasks") row = await this.prisma.task.findFirst({ where: { id, ...resourceScope(user, "tasks") }, select: { id: true } });
      if (!row) throw new NotFoundException();
      if (kind === "customers" && row.leadId) await check("leads", row.leadId);
    };
    const kind = String(req.route?.path ?? "").match(/\/(leads|customers|quotations|follow-ups|tasks)(?:\/|$)/)?.[1];
    if (req.params?.id && kind) await check(kind, req.params.id);
    if (body.otherId) await check("leads", body.otherId);
    if (body.customerId) await check("customers", body.customerId);
    if (body.leadId) await check("leads", body.leadId);
    if (body.ids !== undefined) {
      if (!Array.isArray(body.ids) || body.ids.length > 100) throw new BadRequestException("Invalid record ids");
      for (const id of body.ids) await check("leads", id);
    }
    if (!ids.length && req.method !== "GET") throw new ForbiddenException("No authorized branch");
    return true;
  }
}
