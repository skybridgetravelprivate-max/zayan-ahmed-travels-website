import { GlobalFinanceGuard } from "../auth/global-finance.guard";
import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { PrismaService } from "../common/prisma.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { PermissionGuard, RequirePermission } from "../auth/permission.guard";
import { ResourcesService } from "../resources/resources.service";
import { AuthUser } from "../auth/auth.types";
import { OutboundMessageService } from "../common/outbound-message.service";
import { Headers } from "@nestjs/common";

import { reportCsv } from "./csv";
import { ReportsService } from "./reports.service";
import { StaffAccessService } from "../auth/staff-access.service";

@Controller("v1/reports")
@UseGuards(JwtAuthGuard, PermissionGuard, GlobalFinanceGuard)
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
    const data = await this.reports.run(key, query.format === "csv" ? { ...query, page: "1", pageSize: "50000" } : query);
    if (query.format === "csv") {
      const rows = data.rows as Record<string, unknown>[];
      if (!rows.length) {
        res.setHeader("Content-Type", "text/csv");
        return res.send("");
      }
      const csv = reportCsv(rows);
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
    const rows: Record<string, unknown>[] = [];
    let expectedTotal: number | undefined;
    const seen = new Set<unknown>();
    for (let page = 1; page <= 50; page++) {
      // Use the same authorization/redaction path; never raise the public list cap.
      const result = await this.resources.list(resource, req.user, { ...query, page: String(page), pageSize: "100", sort: "id", dir: "asc" });
      if (result.total > 5000) throw new BadRequestException("Export exceeds 5000 rows; narrow the filters");
      if (expectedTotal !== undefined && expectedTotal !== result.total) throw new BadRequestException("Export changed while reading; retry with narrower filters");
      expectedTotal = result.total;
      for (const row of result.data as Record<string, unknown>[]) {
        if (seen.has(row.id)) throw new BadRequestException("Export changed while reading; retry with narrower filters");
        seen.add(row.id); rows.push(row);
      }
      if (rows.length >= result.total) break;
      if (!(result.data as unknown[]).length || page === 50) throw new BadRequestException("Export changed while reading; retry with narrower filters");
    }
    if (!rows.length) {
      res.setHeader("Content-Type", "text/csv");
      return res.send("");
    }
    const keys = Object.keys(rows[0]).filter((k) => k !== "passwordHash");
    const csv = reportCsv(rows, keys);
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
  constructor(private outbound: OutboundMessageService) {}

  @Get("submissions/:id")
  @UseGuards(GlobalFinanceGuard)
  @RequirePermission("settings.manage")
  reviewSubmission(@Param("id") id: string) {
    return this.outbound.review(id);
  }

  @Post("email")
  @RequirePermission("settings.manage")
  email(@Body() body: { to: string; subject: string; html: string }, @Req() req: Request & { user: AuthUser }, @Headers("idempotency-key") key?: string) {
    const html = (typeof body?.html === "string" ? body.html : "")
      .replace(/<script\b[\s\S]*?<\/script>/gi, "")
      .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "");
    return this.outbound.submitEmail(req.user.id, { to: body?.to, subject: body?.subject, html }, key);
  }

  @Get("email/submission/:key")
  emailStatus(@Param("key") key: string, @Req() req: Request & { user: AuthUser }) {
    return this.outbound.status(req.user.id, key, "EMAIL");
  }

  @Post("email/:id/reconcile")
  @UseGuards(GlobalFinanceGuard)
  @RequirePermission("settings.manage")
  reconcileEmail(@Param("id") id: string, @Body() body: { status: string; reason: string; providerReference?: string }, @Req() req: Request & { user: AuthUser }) {
    return this.outbound.reconcile(req.user.id, id, body, "EMAIL");
  }

  @Post("whatsapp")
  @RequirePermission("settings.manage")
  whatsapp(@Body() body: { to: string; message: string }, @Req() req: Request & { user: AuthUser }, @Headers("idempotency-key") key?: string) {
    return this.outbound.submit(req.user.id, body, key);
  }

  @Get("whatsapp/submission/:key")
  whatsappStatus(@Param("key") key: string, @Req() req: Request & { user: AuthUser }) {
    return this.outbound.status(req.user.id, key);
  }

  @Post("whatsapp/:id/reconcile")
  @UseGuards(GlobalFinanceGuard)
  @RequirePermission("settings.manage")
  reconcileWhatsapp(@Param("id") id: string, @Body() body: { status: string; reason: string; providerReference?: string }, @Req() req: Request & { user: AuthUser }) {
    return this.outbound.reconcile(req.user.id, id, body);
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
  async setPerms(@Param("id") id: string, @Body() body: { permissionIds: string[] }, @Req() req: Request & { user: AuthUser }) {
    return new StaffAccessService(this.prisma).setPermissions(req.user, id, body.permissionIds);
  }

  @Post("users/:id/roles")
  @RequirePermission("user.manage")
  async setRoles(
    @Param("id") id: string,
    @Body() body: { roleIds: string[] },
    @Req() req: Request & { user: AuthUser },
  ) {
    return new StaffAccessService(this.prisma).save(req.user, id, { roleIds: body.roleIds }, true);
  }

  @Post("users/:id/branches")
  @RequirePermission("user.manage")
  async setBranches(@Param("id") id: string, @Body() body: { branchIds: string[] }, @Req() req: Request & { user: AuthUser }) {
    return new StaffAccessService(this.prisma).save(req.user, id, { branchIds: body.branchIds }, true);
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
  async packages() {
    const packages = await this.prisma.umrahPackage.findMany({
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
        makkahHotel: {
          select: { name: true, distance: true, status: true, deletedAt: true },
        },
        madinahHotel: {
          select: { name: true, distance: true, status: true, deletedAt: true },
        },
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
    const publicHotel = (hotel: {
      name: string;
      distance: string | null;
      status: string;
      deletedAt: Date | null;
    } | null) => hotel?.status === "ACTIVE" && !hotel.deletedAt
      ? { name: hotel.name, distance: hotel.distance }
      : null;
    return packages.map(item => ({
      ...item,
      makkahHotel: publicHotel(item.makkahHotel),
      madinahHotel: publicHotel(item.madinahHotel),
    }));
  }
}
