import { BadRequestException, Body, Controller, Headers, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { PermissionGuard, RequirePermission } from "../auth/permission.guard";
import { AuthUser } from "../auth/auth.types";
import { ResourcesService } from "../resources/resources.service";
import { PrismaService } from "../common/prisma.service";
import { SequenceService } from "../common/sequence.service";
import { AuditService } from "../common/audit.service";
import { submitWebsiteInquiry } from "./inquiry-submission";

type WebsiteLeadBody = {
  fullName?: string;
  mobile?: string;
  email?: string;
  notes?: string;
};

/**
 * Website inquiry → CRM lead (staff JWT from server-side CRM_API_* login).
 * Dedicated website endpoint; generic lead creation remains on POST /api/v1/leads.
 */
@Controller("v1/website")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WebsiteLeadsController {
  constructor(private resources: ResourcesService, private prisma: PrismaService) {}

  @Post("leads")
  @RequirePermission("lead.create")
  async createFromWebsite(
    @Body() body: WebsiteLeadBody,
    @Req() req: Request & { user: AuthUser },
    @Headers("idempotency-key") key?: string,
  ) {
    const fullName = (body.fullName ?? "").trim();
    const mobile = (body.mobile ?? "").trim();
    if (!fullName || !mobile) {
      throw new BadRequestException("fullName and mobile are required");
    }
    const payload = {
        fullName,
        mobile,
        email: body.email?.trim() || undefined,
        notes: body.notes?.trim() || undefined,
        source: "WEBSITE",
    };
    if (key !== undefined) {
      return this.prisma.$transaction(async tx => {
        const db = tx as PrismaService;
        const resources = new ResourcesService(db, new SequenceService(db), new AuditService(db));
        return submitWebsiteInquiry(tx, ["staff", req.user.id, req.user.defaultBranchId ?? ""], key, payload, async () => {
          const lead = await resources.create("leads", req.user, payload, req.ip);
          if (typeof lead.id !== "string" || !lead.id) throw new Error("CRM lead ID is missing");
          return { id: lead.id };
        });
      }, { isolationLevel: "ReadCommitted" });
    }
    const created = await this.resources.create("leads", req.user, payload, req.ip);
    const id = typeof (created as { id?: unknown }).id === "string" ? (created as { id: string }).id : "";
    if (!id) {
      return created;
    }
    return { id };
  }
}
