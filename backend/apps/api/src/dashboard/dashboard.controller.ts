import { financialSummary } from "./financial-summary";
import { ForbiddenException, Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RequirePermission } from "../auth/permission.guard";
import { PermissionGuard } from "../auth/permission.guard";
import { PrismaService } from "../common/prisma.service";
import { businessMonth } from "../crm/business-day";
import { resourceScope } from "../resources/resource-scope";
import { AuthUser, can } from "../auth/auth.types";

@Controller("v1/dashboard")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DashboardController {
  constructor(private prisma: PrismaService) {}

  /** Operational counters only; not revenue, ledger balances or all-service totals. */
  @Get("workspace")
  @RequirePermission("dashboard.view")
  async workspace(@Req() req: Request & { user: AuthUser }, now = new Date()) {
    const user = req.user;
    const settings = await this.prisma.companySettings.findFirst({
      select: { timezone: true },
    });
    const timeZone = settings?.timezone || "Asia/Karachi";
    const period = businessMonth(timeZone, now);
    const createdAt = {
      gte: period.start,
      lt: new Date(Math.min(+period.endExclusive, +now + 1)),
    };
    const [customers, leads, confirmedUmrah, pendingUmrahVisas] =
      await Promise.all([
        can(user, "customer.view")
          ? this.prisma.customer.count({
              where: {
                AND: [
                  resourceScope(user, "customers"),
                  { createdAt, deletedAt: null },
                ],
              },
            })
          : null,
        can(user, "lead.view")
          ? this.prisma.lead.count({
              where: {
                AND: [
                  resourceScope(user, "leads"),
                  { createdAt, archivedAt: null },
                ],
              },
            })
          : null,
        can(user, "booking.view")
          ? this.prisma.umrahBooking.count({
              where: {
                AND: [
                  resourceScope(user, "umrah-bookings"),
                  { createdAt, status: "CONFIRMED" },
                ],
              },
            })
          : null,
        user.isSuperAdmin
          ? this.prisma.umrahVisa.count({
              where: {
                status: {
                  in: ["DOCUMENT_PENDING", "READY", "SUBMITTED", "PROCESSING"],
                },
              },
            })
          : null,
      ]);
    return {
      timeZone,
      period,
      scope: user.isSuperAdmin ? "All branches" : "Your authorized branches",
      generatedAt: now,
      metrics: [
        {
          key: "customers",
          label: "New CRM customers",
          value: customers,
          basis: "Created this month; excludes deleted customers",
        },
        {
          key: "leads",
          label: "New inquiries",
          value: leads,
          basis: "Created this month; excludes archived leads",
        },
        {
          key: "confirmedUmrah",
          label: "Confirmed Umrah bookings",
          value: confirmedUmrah,
          basis: "Created this month and currently confirmed",
        },
        {
          key: "pendingUmrahVisas",
          label: "Umrah visas in progress",
          value: pendingUmrahVisas,
          basis: "Current pipeline across all dates; administrator view",
        },
      ],
    };
  }

  @Get("summary")
  @RequirePermission("dashboard.view")
  async summary(
    @Query() q: { preset?: string; from?: string; to?: string; branchId?: string; agentId?: string; currency?: string },
    @Req() req: Request & { user: AuthUser },
  ) {
    if (!req.user.isSuperAdmin) throw new ForbiddenException("Global financial summary requires super-admin access");
    return this.prisma.$transaction(tx => financialSummary(tx as PrismaService, q), { isolationLevel: "RepeatableRead" });
  }

  @Get("charts")
  @RequirePermission("dashboard.view")
  async charts(@Query() _q: { branchId?: string }, @Req() _req: Request & { user: AuthUser }) {
    if (!_req.user.isSuperAdmin) throw new ForbiddenException("Global financial charts require super-admin access");
    const year = new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => i);
    const byMonth = async (model: "ticketSale" | "umrahBooking" | "hotelBooking" | "expense" | "lead") => {
      const out: { month: number; value: number }[] = [];
      for (const m of months) {
        const gte = new Date(year, m, 1);
        const lte = new Date(year, m + 1, 0, 23, 59, 59);
        if (model === "expense") {
          const a = await this.prisma.expense.aggregate({ _sum: { amount: true }, where: { date: { gte, lte } } });
          out.push({ month: m + 1, value: Number(a._sum.amount ?? 0) });
        } else if (model === "lead") {
          const c = await this.prisma.lead.count({ where: { createdAt: { gte, lte } } });
          out.push({ month: m + 1, value: c });
        } else if (model === "ticketSale") {
          const a = await this.prisma.ticketSale.aggregate({ _sum: { net: true, profit: true }, where: { createdAt: { gte, lte } } });
          out.push({ month: m + 1, value: Number(a._sum.net ?? 0) });
        } else if (model === "hotelBooking") {
          const a = await this.prisma.hotelBooking.aggregate({ _sum: { net: true }, where: { createdAt: { gte, lte } } });
          out.push({ month: m + 1, value: Number(a._sum.net ?? 0) });
        } else {
          const a = await this.prisma.umrahBooking.aggregate({
            _sum: { net: true, profit: true },
            where: { createdAt: { gte, lte } },
          });
          out.push({ month: m + 1, value: Number(a._sum.net ?? 0) });
        }
      }
      return out;
    };

    const [sales, umrah, tickets, hotels, expenses, leadsBySource, packages] = await Promise.all([
      byMonth("umrahBooking"),
      byMonth("umrahBooking"),
      byMonth("ticketSale"),
      byMonth("hotelBooking"),
      byMonth("expense"),
      this.prisma.lead.groupBy({ by: ["source"], _count: true }),
      this.prisma.umrahBooking.groupBy({ by: ["packageId"], _count: true, _sum: { net: true } }),
    ]);

    const profit = await Promise.all(
      months.map(async (m) => {
        const gte = new Date(year, m, 1);
        const lte = new Date(year, m + 1, 0, 23, 59, 59);
        const u = await this.prisma.umrahBooking.aggregate({ _sum: { profit: true }, where: { createdAt: { gte, lte } } });
        const t = await this.prisma.ticketSale.aggregate({ _sum: { profit: true }, where: { createdAt: { gte, lte } } });
        const e = await this.prisma.expense.aggregate({ _sum: { amount: true }, where: { date: { gte, lte } } });
        return { month: m + 1, value: Number(u._sum.profit ?? 0) + Number(t._sum.profit ?? 0) - Number(e._sum.amount ?? 0) };
      }),
    );

    const bookings = await Promise.all(
      months.map(async (m) => {
        const gte = new Date(year, m, 1);
        const lte = new Date(year, m + 1, 0, 23, 59, 59);
        const c = await this.prisma.umrahBooking.count({ where: { createdAt: { gte, lte } } });
        return { month: m + 1, value: c };
      }),
    );

    const agents = await this.prisma.umrahBooking.groupBy({ by: ["agentId"], _sum: { net: true }, _count: true });

    return {
      salesByMonth: sales,
      profitByMonth: profit,
      bookingsByMonth: bookings,
      ticketSales: tickets,
      hotelSales: hotels,
      umrahSales: umrah,
      expenses,
      leadsBySource,
      agentPerformance: agents,
      packagePerformance: packages,
    };
  }
}
