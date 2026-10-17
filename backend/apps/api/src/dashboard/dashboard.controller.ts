import { ForbiddenException, Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { Prisma } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RequirePermission } from "../auth/permission.guard";
import { PermissionGuard } from "../auth/permission.guard";
import { PrismaService } from "../common/prisma.service";
import { AuthUser } from "../auth/auth.types";

function range(preset?: string, from?: string, to?: string) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  if (from && to) return { gte: new Date(from), lte: new Date(to) };
  switch (preset) {
    case "today":
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "this_week": {
      const d = start.getDay();
      start.setDate(start.getDate() - d);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "last_month":
      start.setMonth(start.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "this_year":
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
    case "this_month":
    default:
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
  }
  return { gte: start, lte: end };
}

@Controller("v1/dashboard")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DashboardController {
  constructor(private prisma: PrismaService) {}

  @Get("summary")
  @RequirePermission("dashboard.view")
  async summary(
    @Query() q: { preset?: string; from?: string; to?: string; branchId?: string; agentId?: string; currency?: string },
    @Req() req: Request & { user: AuthUser },
  ) {
    if (!req.user.isSuperAdmin) throw new ForbiddenException("Global financial summary requires super-admin access");
    const createdAt = range(q.preset, q.from, q.to);
    const branchFilter = (field = "branchId") => {
      if (q.branchId) return { [field]: q.branchId };
      if (!req.user.isSuperAdmin && req.user.branchIds.length) return { [field]: { in: req.user.branchIds } };
      return {};
    };
    const agent = q.agentId ? { agentId: q.agentId } : {};

    const _sum = (agg: { _sum: { net?: Prisma.Decimal | null; amount?: Prisma.Decimal | null; paid?: Prisma.Decimal | null; balance?: Prisma.Decimal | null; profit?: Prisma.Decimal | null } }) =>
      Number(agg._sum.net ?? agg._sum.amount ?? 0);
    void _sum;

    const [
      ticketSales,
      hotelSales,
      transportSales,
      visaSales,
      umrahSales,
      umrahPaid,
      expenses,
      customers,
      newLeads,
      confirmedBookings,
      umrahPax,
      pendingVisa,
      upcomingDepartures,
      receiptsToday,
      _receivables,
      payables,
      cash,
      bank,
      followUps,
    ] = await Promise.all([
      this.prisma.ticketSale.aggregate({ _sum: { net: true, profit: true }, where: { createdAt, ...branchFilter(), ...agent } }),
      this.prisma.hotelBooking.aggregate({ _sum: { net: true }, where: { createdAt, ...branchFilter(), ...agent } }),
      this.prisma.transportBooking.aggregate({ _sum: { net: true }, where: { createdAt, ...branchFilter() } }),
      this.prisma.visaApplication.aggregate({ _sum: { sellingPrice: true }, where: { createdAt, ...branchFilter() } }),
      this.prisma.umrahBooking.aggregate({ _sum: { net: true, paid: true, balance: true, profit: true }, where: { createdAt, ...branchFilter(), ...agent } }),
      this.prisma.umrahBooking.aggregate({ _sum: { paid: true, balance: true }, where: { ...branchFilter() } }),
      this.prisma.expense.aggregate({ _sum: { amount: true }, where: { date: createdAt, ...branchFilter() } }),
      this.prisma.customer.count({ where: { createdAt, ...branchFilter() } }),
      this.prisma.lead.count({ where: { createdAt, ...branchFilter(), archivedAt: null } }),
      this.prisma.umrahBooking.count({ where: { createdAt, status: "CONFIRMED", ...branchFilter() } }),
      this.prisma.umrahBookingPassenger.count({
        where: { booking: { createdAt, ...branchFilter() } },
      }),
      this.prisma.umrahVisa.count({ where: { status: { in: ["DOCUMENT_PENDING", "READY", "SUBMITTED", "PROCESSING"] } } }),
      this.prisma.umrahBooking.count({
        where: { departureDate: { gte: new Date(), lte: new Date(Date.now() + 14 * 86400000) }, ...branchFilter() },
      }),
      this.prisma.receipt.aggregate({
        _sum: { amount: true },
        where: { date: range("today"), ...branchFilter() },
      }),
      this.prisma.umrahBooking.aggregate({ _sum: { balance: true }, where: { ...branchFilter() } }),
      this.prisma.payment.aggregate({ _sum: { amount: true }, where: { ...branchFilter() } }),
      this.prisma.cashAccount.aggregate({ _sum: { openingBalance: true } }),
      this.prisma.bankAccount.aggregate({ _sum: { openingBalance: true } }),
      this.prisma.followUp.findMany({
        where: { status: "PENDING", dueAt: { gte: new Date() } },
        orderBy: { dueAt: "asc" },
        take: 10,
      }),
    ]);

    const starSales = await this.prisma.starBooking.aggregate({
      _sum: { sellingPrice: true, profit: true },
      where: { createdAt, ...branchFilter(), status: { notIn: ["Cancelled", "Expired"] } },
    });
    const ticketNet = Number(ticketSales._sum.net ?? 0);
    const hotelNet = Number(hotelSales._sum.net ?? 0);
    const transportNet = Number(transportSales._sum.net ?? 0);
    const visaNet = Number((visaSales as { _sum: { sellingPrice: unknown } })._sum.sellingPrice ?? 0);
    const umrahNet = Number(umrahSales._sum.net ?? 0);
    const starNet = Number(starSales._sum.sellingPrice ?? 0);
    const totalSales = ticketNet + hotelNet + transportNet + visaNet + umrahNet + starNet;
    const monthlyProfit = Number(umrahSales._sum.profit ?? 0) + Number(ticketSales._sum.profit ?? 0) + Number(starSales._sum.profit ?? 0) - Number(expenses._sum.amount ?? 0);

    const cashPosted = await this.postedBalance("1100");
    const bankPosted = await this.postedBalance("1200");

    return {
      cards: {
        totalSales,
        totalReceivable: Number(umrahPaid._sum.balance ?? 0),
        totalPayable: Number(payables._sum.amount ?? 0),
        cashBalance: cashPosted + Number(cash._sum.openingBalance ?? 0),
        bankBalance: bankPosted + Number(bank._sum.openingBalance ?? 0),
        totalCustomers: customers,
        newLeads,
        confirmedBookings,
        umrahPassengers: umrahPax,
        pendingVisa,
        upcomingDepartures,
        pendingPayments: Number(umrahPaid._sum.balance ?? 0),
        todaysCollection: Number(receiptsToday._sum.amount ?? 0),
        monthlyProfit,
        ticketSales: ticketNet,
        hotelSales: hotelNet,
        transportSales: transportNet,
        visaSales: visaNet,
        umrahSales: umrahNet,
        starSales: starNet,
      },
      upcomingFollowUps: followUps,
    };
  }

  private async postedBalance(code: string) {
    const acc = await this.prisma.chartOfAccount.findUnique({ where: { code } });
    if (!acc) return 0;
    const agg = await this.prisma.journalLine.aggregate({
      where: { accountId: acc.id, journal: { status: { in: ["POSTED", "REVERSED"] } } },
      _sum: { debit: true, credit: true },
    });
    return Number(agg._sum.debit ?? 0) - Number(agg._sum.credit ?? 0);
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
