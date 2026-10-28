import { ManagementOriginGuard } from "../management/management.guard";
import {
  ForbiddenException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { PermissionGuard, RequirePermission } from "../auth/permission.guard";
import { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { AdminService } from "./admin.service";
import { AccountingService } from "../finance/accounting.service";

@Controller("v1/admin")
@UseGuards(JwtAuthGuard, PermissionGuard, ManagementOriginGuard)
export class AdminController {
  constructor(
    private admin: AdminService,
    private prisma: PrismaService,
    private audit: AuditService,
    private accounting: AccountingService,
  ) {}

  @Post("posting")
  @RequirePermission("admin.post")
  postUnposted(@Req() req: Request & { user: AuthUser }) {
    return this.admin.postUnposted(req.user);
  }

  @Post("hotel-discounts")
  @RequirePermission("admin.discount")
  discount(
    @Body() body: { percent: number },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.admin.hotelDiscount(req.user, Number(body.percent));
  }

  @Post("advance")
  @RequirePermission("admin.advance")
  advance(
    @Body() body: { id: string; status: string; reason: string },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.admin.advanceUmrah(req.user, body.id, body.status, body.reason);
  }

  @Post("delete")
  @RequirePermission("admin.delete")
  remove(
    @Body() body: { kind: string; id: string; confirm: string; reason: string },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.admin.deleteRecord(
      req.user,
      body.kind,
      body.id,
      body.confirm,
      body.reason,
    );
  }

  @Get("duplicate-mutamers")
  @RequirePermission("passenger.view")
  dups(@Req() req: Request & { user: AuthUser }) {
    return this.admin.duplicateMutamers(req.user);
  }

  @Post("manual-journal")
  @RequirePermission("account.adjust")
  journal(
    @Body()
    body: {
      memo: string;
      reason: string;
      lines: { accountId: string; debit: number; credit: number }[];
    },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.accounting.postJournal({
      date: new Date(),
      memo: `${body.memo || "Manual"} — ${body.reason || ""}`,
      kind: "ADJUSTMENT",
      module: "admin",
      userId: req.user.id,
      lines: body.lines || [],
    });
  }

  @Post("import/customers")
  @RequirePermission("admin.import")
  importCustomers(
    @Body() body: { rows: Record<string, string>[] },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.admin.importCustomers(req.user, body.rows || []);
  }

  @Get("audit")
  @RequirePermission("audit.view")
  auditLog(@Query() q: { q?: string }) {
    return this.prisma.auditLog.findMany({
      where: q.q
        ? {
            OR: [
              { action: { contains: q.q, mode: "insensitive" } },
              { entity: { contains: q.q, mode: "insensitive" } },
              { entityId: { contains: q.q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  @Get("cms/pages")
  @RequirePermission("cms.view")
  pages() {
    return this.prisma.cmsPage.findMany({ orderBy: { slug: "asc" } });
  }

  @Post("cms/pages")
  @RequirePermission("cms.edit")
  savePage() {
    throw new ForbiddenException(
      "Use /admin/website for reviewed content changes",
    );
  }

  @Get("cms/testimonials")
  @RequirePermission("cms.view")
  testimonials() {
    return this.prisma.cmsTestimonial.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  @Post("cms/testimonials")
  @RequirePermission("cms.edit")
  addQuote() {
    throw new ForbiddenException(
      "Use /admin/website for reviewed content changes",
    );
  }

  @Get("cms/news")
  @RequirePermission("cms.view")
  news() {
    return this.prisma.cmsNews.findMany({ orderBy: { createdAt: "desc" } });
  }

  @Post("cms/news")
  @RequirePermission("cms.edit")
  addNews() {
    throw new ForbiddenException(
      "Use /admin/website for reviewed content changes",
    );
  }

  @Get("cms/html")
  @RequirePermission("cms.view")
  html() {
    return this.prisma.cmsHtmlBlock.findMany();
  }

  @Post("cms/html")
  @RequirePermission("cms.edit")
  saveHtml() {
    throw new ForbiddenException(
      "Use /admin/website for reviewed content changes",
    );
  }

  @Patch("cms/home")
  @RequirePermission("cms.edit")
  home() {
    throw new ForbiddenException(
      "Use /admin/website for reviewed content changes",
    );
  }
}
