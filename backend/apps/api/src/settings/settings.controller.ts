import { Body, Controller, Get, Patch, Req, UseGuards } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { PermissionGuard, RequirePermission } from "../auth/permission.guard";
import { AuthUser, can } from "../auth/auth.types";
import type { Request } from "express";

@Controller("v1/settings")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SettingsController {
  constructor(private prisma: PrismaService) {}

  @Get("company")
  async company(@Req() req: Request & { user: AuthUser }) {
    const row = await this.prisma.companySettings.findFirst();
    if (!row) return null;
    if (can(req.user, "settings.manage")) return row;
    return {
      companyName: row.companyName,
      phone: row.phone,
      email: row.email,
      website: row.website,
      address: row.address,
      whatsapp: row.whatsapp,
    };
  }

  @Patch("company")
  @RequirePermission("settings.manage")
  async update(@Body() body: Record<string, unknown>) {
    const existing = await this.prisma.companySettings.findFirst();
    if (!existing) {
      return this.prisma.companySettings.create({ data: { companyName: String(body.companyName ?? "Company"), ...body } as never });
    }
    return this.prisma.companySettings.update({ where: { id: existing.id }, data: body as never });
  }
}
