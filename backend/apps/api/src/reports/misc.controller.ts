import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { PrismaService } from "../common/prisma.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { PermissionGuard, RequirePermission } from "../auth/permission.guard";
import { ResourcesService } from "../resources/resources.service";
import { AuthUser } from "../auth/auth.types";
import { MailService } from "../common/mail.service";
import { WhatsAppService } from "../common/whatsapp.service";

import { ReportsService } from "./reports.service";

@Controller("v1/reports")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReportsController {
  constructor(
    private prisma: PrismaService,
    private reports: ReportsService,
  ) {}

  @Get("catalog")
  @RequirePermission("report.view")
  catalog() {
    return this.reports.catalog();
  }

  @Get("run/:key")
  @RequirePermission("report.view")
  async run(
    @Param("key") key: string,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const data = await this.reports.run(key, query);
    if (query.format === "csv") {
      const full = await this.reports.run(key, { ...query, page: "1", pageSize: "5000" });
      const rows = full.rows as Record<string, unknown>[];
      if (!rows.length) {
        res.setHeader("Content-Type", "text/csv");
        return res.send("");
      }
      const keys = Object.keys(rows[0]);
      const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${key}.csv"`);
      return res.send(csv);
    }
    return res.json(data);
  }

  @Get("umrah-manifest/:groupId")
  @RequirePermission("report.view")
  async manifest(@Param("groupId") groupId: string) {
    const group = await this.prisma.umrahGroup.findUnique({
      where: { id: groupId },
      include: { bookings: { include: { passengers: { include: { passenger: true } }, customer: true } } },
    });
    return group;
  }

  @Get("passport-expiry")
  @RequirePermission("report.view")
  async expiry() {
    const soon = new Date();
    soon.setDate(soon.getDate() + 90);
    return this.prisma.passenger.findMany({
      where: { passportExpiryDate: { lte: soon } },
      orderBy: { passportExpiryDate: "asc" },
    });
  }
}

@Controller("v1/export")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ExportController {
  constructor(private resources: ResourcesService) {}

  @Get(":resource")
  @RequirePermission("report.export")
  async csv(
    @Param("resource") resource: string,
    @Query() query: Record<string, string>,
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
  ) {
    const result = await this.resources.list(resource, req.user, { ...query, page: "1", pageSize: "5000" });
    const rows = result.data as Record<string, unknown>[];
    if (!rows.length) {
      res.setHeader("Content-Type", "text/csv");
      return res.send("");
    }
    const keys = Object.keys(rows[0]).filter((k) => k !== "passwordHash");
    const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${resource}.csv"`);
    res.send(csv);
  }
}

@Controller("v1/import")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ImportController {
  constructor(private resources: ResourcesService) {}

  @Post("leads")
  @RequirePermission("lead.create")
  async leads(@Body() body: { rows: Record<string, unknown>[] }, @Req() req: Request & { user: AuthUser }) {
    const created = [];
    for (const row of body.rows ?? []) {
      created.push(await this.resources.create("leads", req.user, row, req.ip));
    }
    return { count: created.length };
  }
}

@Controller("v1/comms")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CommsController {
  constructor(private mail: MailService, private wa: WhatsAppService) {}

  @Post("email")
  @RequirePermission("settings.manage")
  email(@Body() body: { to: string; subject: string; html: string }) {
    const html = String(body.html || "")
      .replace(/<script\b[\s\S]*?<\/script>/gi, "")
      .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "");
    return this.mail.send(body.to, body.subject, html);
  }

  @Post("whatsapp")
  @RequirePermission("settings.manage")
  whatsapp(@Body() body: { to: string; message: string }) {
    return this.wa.send(body.to, String(body.message || "").slice(0, 4000));
  }
}

@Controller("v1/rbac")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RbacController {
  constructor(private prisma: PrismaService) {}

  @Get("permissions")
  @RequirePermission("role.manage")
  permissions() {
    return this.prisma.permission.findMany({ orderBy: { code: "asc" } });
  }

  @Post("roles/:id/permissions")
  @RequirePermission("role.manage")
  async setPerms(@Param("id") id: string, @Body() body: { permissionIds: string[] }) {
    await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
    await this.prisma.rolePermission.createMany({
      data: (body.permissionIds ?? []).map((permissionId) => ({ roleId: id, permissionId })),
    });
    return { ok: true };
  }

  @Post("users/:id/roles")
  @RequirePermission("user.manage")
  async setRoles(
    @Param("id") id: string,
    @Body() body: { roleIds: string[] },
    @Req() req: Request & { user: AuthUser },
  ) {
    const superRoles = await this.prisma.role.findMany({
      where: { name: { in: ["SUPER_ADMIN", "Super Admin"] } },
      select: { id: true },
    });
    const superIds = new Set(superRoles.map((r) => r.id));
    const wantsSuper = (body.roleIds ?? []).some((rid) => superIds.has(rid));
    if (wantsSuper && !req.user.isSuperAdmin) throw new ForbiddenException();
    await this.prisma.userRole.deleteMany({ where: { userId: id } });
    await this.prisma.userRole.createMany({
      data: (body.roleIds ?? []).map((roleId) => ({ userId: id, roleId })),
    });
    return { ok: true };
  }

  @Post("users/:id/branches")
  @RequirePermission("user.manage")
  async setBranches(@Param("id") id: string, @Body() body: { branchIds: string[] }) {
    await this.prisma.userBranch.deleteMany({ where: { userId: id } });
    await this.prisma.userBranch.createMany({
      data: (body.branchIds ?? []).map((branchId) => ({ userId: id, branchId })),
    });
    return { ok: true };
  }
}

@Controller("public")
export class PublicController {
  constructor(private prisma: PrismaService) {}

  @Get("company")
  company() {
    return this.prisma.companySettings.findFirst({
      select: { companyName: true, phone: true, email: true, website: true, address: true, whatsapp: true },
    });
  }

  @Get("pages/:slug")
  page(@Param("slug") slug: string) {
    return this.prisma.cmsPage.findFirst({
      where: { slug, status: "PUBLISHED" },
      select: { slug: true, title: true, body: true, status: true, updatedAt: true },
    });
  }

  @Get("testimonials")
  testimonials() {
    return this.prisma.cmsTestimonial.findMany({ where: { published: true }, orderBy: { createdAt: "desc" } });
  }

  @Get("news")
  news() {
    return this.prisma.cmsNews.findMany({ where: { published: true }, orderBy: { createdAt: "desc" } });
  }

  @Get("umrah-packages")
  packages() {
    return this.prisma.umrahPackage.findMany({
      where: { isPublic: true, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        packageType: true,
        durationDays: true,
        departureCity: true,
        arrivalCity: true,
        departureDate: true,
        returnDate: true,
        flightInfo: true,
        makkahNights: true,
        madinahNights: true,
        roomType: true,
        includesTransport: true,
        includesVisa: true,
        includesMeals: true,
        includesZiyarat: true,
        adultPrice: true,
        childPrice: true,
        infantPrice: true,
        description: true,
      },
    });
  }
}
