import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { PermissionGuard, RequirePermission } from "../auth/permission.guard";
import { AuthUser, can } from "../auth/auth.types";
import { branchWhere } from "../auth/record-scope";
import { requireAgencyEnabled } from "./agency-access";
import { agencyPage } from "./agency.service";

@Controller("v1/agency-review")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AgencyReviewController {
  constructor(private db: PrismaService, private audit: AuditService) {}

  @Post(":id/lead")
  @RequirePermission("agent.edit")
  async linkLead(@Req() req: Request & { user: AuthUser }, @Param("id") id: string, @Body() body: { leadReference?: unknown }) {
    requireAgencyEnabled();
    if (!can(req.user, "lead.view")) throw new ForbiddenException();
    if (Object.keys(body || {}).some(key => key !== "leadReference") || typeof body?.leadReference !== "string"
      || !/^[A-Za-z0-9_-]{1,80}$/.test(body.leadReference) || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) {
      throw new BadRequestException("Choose an existing authorised lead");
    }
    const leadReference = body.leadReference;
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`agency-lead:${id}`}, 5))::text`;
      const request = await tx.agencyRequest.findFirst({ where: { id, agent: branchWhere(req.user) }, include: { agent: true } });
      if (!request || !request.agent.branchId) throw new NotFoundException();
      const lead = await tx.lead.findFirst({ where: { OR: [{ id: leadReference }, { leadNumber: leadReference }], assignedAgentId: request.agentId, branchId: request.agent.branchId } });
      if (!lead) throw new NotFoundException();
      const leadId = lead.id;
      if (request.leadId && request.leadId !== leadId) throw new BadRequestException("This request already has an operational lead. Review ownership with staff.");
      if (!request.leadId) {
        await tx.agencyRequest.update({ where: { id }, data: { leadId } });
        await this.audit.log({ userId: req.user.id, action: "agency.link-lead", entity: "AgencyRequest", entityId: id, db: tx });
      }
      return { ok: true, notice: "Existing agency lead linked. Continue quotation and booking work through the CRM." };
    });
  }
  @Get()
  @RequirePermission("agent.view")
  async list(@Req() req: Request & { user: AuthUser }, @Query("page") page?: string) {
    requireAgencyEnabled();
    const where = { agent: branchWhere(req.user) };
    const [rows, total] = await Promise.all([this.db.agencyRequest.findMany({ where, ...agencyPage(page), orderBy: [{ createdAt: "desc" }, { id: "asc" }], select: { id: true, kind: true, subject: true, message: true, status: true, reply: true, updatedAt: true, agent: { select: { name: true } } } }), this.db.agencyRequest.count({ where })]);
    return { rows, total, canLinkLead: can(req.user, "lead.view") && can(req.user, "agent.edit") };
  }
  @Post(":id/reply")
  @RequirePermission("agent.edit")
  async reply(@Req() req: Request & { user: AuthUser }, @Param("id") id: string, @Body() body: { publicReply?: unknown; version?: unknown }) {
    requireAgencyEnabled();
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) || typeof body.publicReply !== "string" || !body.publicReply.trim() || body.publicReply.length > 4000 || typeof body.version !== "string" || Number.isNaN(Date.parse(body.version))) throw new BadRequestException("Provide a public reply and current record version");
    return this.db.$transaction(async tx => {
      const before = await tx.agencyRequest.findFirst({ where: { id, agent: branchWhere(req.user) } });
      if (!before) throw new NotFoundException();
      const result = await tx.agencyRequest.updateMany({ where: { id, updatedAt: new Date(body.version as string), agent: branchWhere(req.user) }, data: { reply: (body.publicReply as string).trim(), status: "RESPONDED" } });
      if (result.count !== 1) throw new BadRequestException("Request changed; reload before replying");
      await this.audit.log({ userId: req.user.id, action: "agency.reply", entity: "AgencyRequest", entityId: id, db: tx });
      return { ok: true, notice: "Public reply saved. No booking, receipt or refund was executed." };
    });
  }
}
