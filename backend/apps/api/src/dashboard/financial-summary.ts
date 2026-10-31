import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "../common/prisma.service";
import { businessDate, businessDay, businessMonth } from "../crm/business-day";

export async function financialSummary(db: PrismaService, query: { preset?: string; from?: string; to?: string; branchId?: string; agentId?: string; currency?: string }, now = new Date()) {
  if (query.agentId || (query.currency && query.currency !== "PKR")) throw new BadRequestException("This ledger summary supports pooled PKR and branch filters; agent/foreign-currency summaries are unavailable");
  if (query.branchId && !/^[A-Za-z0-9_-]{1,80}$/.test(query.branchId)) throw new BadRequestException("Invalid branch");
  const timeZone = (await db.companySettings.findFirst({ select: { timezone: true } }))?.timezone || "Asia/Karachi";
  let period = businessMonth(timeZone, now);
  try {
    if (query.from || query.to) {
      if (!query.from || !query.to) throw new RangeError();
      period = { start: businessDate(timeZone, query.from), endExclusive: businessDate(timeZone, query.to, true) };
    } else if (query.preset === "today") period = businessDay(timeZone, now);
    else if (query.preset && query.preset !== "this_month") {
      const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map(part => [part.type, part.value]));
      const year = Number(parts.year), month = Number(parts.month), day = Number(parts.day);
      const date = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
      if (query.preset === "last_month") period = { start: businessDate(timeZone, date(year, month - 1, 1)), endExclusive: businessDate(timeZone, date(year, month, 1)) };
      else if (query.preset === "this_year") period = { start: businessDate(timeZone, date(year, 1, 1)), endExclusive: now };
      else if (query.preset === "this_week") period = { start: businessDate(timeZone, date(year, month, day - new Date(Date.UTC(year, month - 1, day)).getUTCDay())), endExclusive: now };
      else throw new BadRequestException("Unsupported period");
    }
    if (period.start >= period.endExclusive) throw new RangeError();
  } catch { throw new BadRequestException("Invalid or unsupported company-calendar range"); }
  const asOfExclusive = new Date(Math.min(period.endExclusive.getTime(), now.getTime() + 1));
  const branch = query.branchId ? { branchId: query.branchId } : {};
  const posted = { status: { in: ["POSTED", "REVERSED"] as ("POSTED" | "REVERSED")[] }, ...branch };
  const balance = async (code: string, creditNormal = false) => {
    const sum = await db.journalLine.aggregate({ where: { account: { code }, journal: { ...posted, date: { lt: asOfExclusive } } }, _sum: { debit: true, credit: true } });
    const value = new Prisma.Decimal(sum._sum.debit ?? 0).minus(sum._sum.credit ?? 0);
    return (creditNormal ? value.negated() : value).toFixed(2);
  };
  const movement = async (type: "REVENUE" | "EXPENSE") => {
    const sum = await db.journalLine.aggregate({ where: { account: { type }, journal: { ...posted, date: { gte: period.start, lt: asOfExclusive } } }, _sum: { debit: true, credit: true } });
    const debit = new Prisma.Decimal(sum._sum.debit ?? 0), credit = new Prisma.Decimal(sum._sum.credit ?? 0);
    return type === "REVENUE" ? credit.minus(debit) : debit.minus(credit);
  };
  const [ar, ap, cash, bank, revenue, expense] = await Promise.all([balance("1300"), balance("2100", true), balance("1100"), balance("1200"), movement("REVENUE"), movement("EXPENSE")]);
  return {
    basis: { currency: "PKR", timeZone, branchId: query.branchId || null, from: period.start.toISOString(), asOfExclusive: asOfExclusive.toISOString(), balances: "Signed posted ledger balances, including reversals; unposted account opening fields excluded", movement: "Posted revenue and expense movement in selected company period", contractVersion: 2, retiredFields: "Operational counts and service/source subtotals use their own workspaces/reports" },
    cards: { totalReceivable: ar, pendingPayments: ar, totalPayable: ap, cashBalance: cash, bankBalance: bank, totalSales: revenue.toFixed(2), monthlyProfit: revenue.minus(expense).toFixed(2) },
  };
}
