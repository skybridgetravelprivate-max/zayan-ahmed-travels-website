import { BadRequestException, Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { PermissionGuard, RequirePermission } from "../auth/permission.guard";
import { AuthUser } from "../auth/auth.types";
import { ResourcesService } from "../resources/resources.service";

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
  constructor(private resources: ResourcesService) {}

  @Post("leads")
  @RequirePermission("lead.create")
  async createFromWebsite(
    @Body() body: WebsiteLeadBody,
    @Req() req: Request & { user: AuthUser },
  ) {
    const fullName = (body.fullName ?? "").trim();
    const mobile = (body.mobile ?? "").trim();
    if (!fullName || !mobile) {
      throw new BadRequestException("fullName and mobile are required");
    }
    const created = await this.resources.create(
      "leads",
      req.user,
      {
        fullName,
        mobile,
        email: body.email?.trim() || undefined,
        notes: body.notes?.trim() || undefined,
        source: "WEBSITE",
      },
      req.ip,
    );
    const id = typeof (created as { id?: unknown }).id === "string" ? (created as { id: string }).id : "";
    if (!id) {
      return created;
    }
    return { id };
  }
}
