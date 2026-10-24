import { GlobalFinanceGuard } from "../auth/global-finance.guard";
import { ReceiptOperations, receiptSubmissionId, type ReceiptInput } from "./receipt-operations";
import { Prisma } from "@prisma/client";
import { BadRequestException, ConflictException, NotFoundException, Body, Controller, Get, Header, Headers, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { PrismaService } from "../common/prisma.service";
import { SequenceService } from "../common/sequence.service";
import { AuditService } from "../common/audit.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { PermissionGuard, RequirePermission } from "../auth/permission.guard";
import { AuthUser } from "../auth/auth.types";
import { AccountingService } from "./accounting.service";

@Controller("v1/finance")
@UseGuards(JwtAuthGuard, PermissionGuard, GlobalFinanceGuard)
export class FinanceController {
  constructor(
    private prisma: PrismaService,
    private seq: SequenceService,
    private audit: AuditService,
    private accounting: AccountingService,
  ) {}

  private async account(code: string) {
    return this.accounting.accountByCode(code);
  }

  private receiptId(userId: string, key: unknown) { return receiptSubmissionId(userId, key); }
  private get receiptOperations() { return new ReceiptOperations(this.prisma, this.seq, this.audit, this.accounting); }

  @Get("receipts/submission/:key")
  @Header("Cache-Control", "private, no-store")
  @RequirePermission("account.post")
  async receiptSubmission(@Param("key") key: string, @Req() req: Request & { user: AuthUser }) {
    const receipt = await this.prisma.receipt.findUnique({ where: { id: this.receiptId(req.user.id, key) } });
    if (!receipt) throw new NotFoundException("Receipt is not confirmed. Retry the original submission.");
    return { id: receipt.id, receiptNo: receipt.receiptNo, amount: receipt.amount, method: receipt.method };
  }

  @Post("receipts/:id/review")
  @RequirePermission("account.post")
  async reviewReceipt(@Param("id") id: string, @Body() body: { reviewed?: boolean }, @Req() req: Request & { user: AuthUser }) {
    return this.receiptOperations.review(id, body.reviewed === true, req.user);
  }

  @Post("journals")
  @RequirePermission("account.post")
  async createJournal(
    @Body() body: {
      date?: string;
      memo?: string;
      kind?: string;
      lines: { accountId: string; debit: number; credit: number; memo?: string; partyType?: string; partyId?: string }[];
    },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.accounting.postJournal({
      date: body.date ? new Date(body.date) : new Date(),
      memo: body.memo || "Manual posting",
      kind: body.kind || "MANUAL",
      module: "accounts",
      branchId: req.user.defaultBranchId,
      userId: req.user.id,
      lines: body.lines || [],
    });
  }

  @Post("journals/:id/post")
  @RequirePermission("account.post")
  async postExisting(@Param("id") id: string, @Req() req: Request & { user: AuthUser }) {
    return this.accounting.postExisting(id, req.user.id);
  }

  @Post("journals/:id/reverse")
  @RequirePermission("account.reverse")
  async reverse(@Param("id") id: string, @Req() req: Request & { user: AuthUser }) {
    return this.accounting.reverse(id, req.user.id);
  }

  @Post("receipts")
  @RequirePermission("account.post")
  async createReceipt(
    @Body() body: ReceiptInput,
    @Req() req: Request & { user: AuthUser },
    @Headers("idempotency-key") requestKey?: string,
  ) {
    return this.receiptOperations.create(body, req.user, requestKey);
  }

  @Post("payments")
  @RequirePermission("account.post")
  async createPayment(
    @Body() body: { supplierId?: string; amount: number; method: string; branchId?: string; notes?: string },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.prisma.$transaction(async tx => {
    const journal = await this.accounting.postPayment({
      db: tx,
      userId: req.user.id,
      amount: Number(body.amount),
      method: body.method,
      supplierId: body.supplierId,
      branchId: body.branchId || req.user.defaultBranchId,
      module: "accounts",
    });
    const paymentNo = await this.seq.next("pay", "ZAT-PAY", tx);
    return tx.payment.create({
      data: {
        paymentNo,
        supplierId: body.supplierId,
        amount: body.amount,
        method: body.method,
        branchId: body.branchId || req.user.defaultBranchId,
        notes: body.notes,
        journalId: journal.id,
      },
    });
    });
  }

  @Post("expenses")
  @RequirePermission("account.post")
  async createExpense(
    @Body() body: { category: string; amount: number; supplierId?: string; branchId?: string; notes?: string },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.prisma.$transaction(async tx => {
    const journal = await this.accounting.postExpense({
      db: tx,
      userId: req.user.id,
      amount: Number(body.amount),
      category: body.category,
      branchId: body.branchId || req.user.defaultBranchId,
    });
    const expenseNo = await this.seq.next("exp", "ZAT-EXP", tx);
    return tx.expense.create({
      data: {
        expenseNo,
        category: body.category,
        amount: body.amount,
        supplierId: body.supplierId,
        branchId: body.branchId || req.user.defaultBranchId,
        notes: body.notes,
        journalId: journal.id,
      },
    });
    });
  }

  @Get("general-ledger")
  @RequirePermission("account.view")
  async gl(@Query() q: { accountId?: string; from?: string; to?: string }) {
    return this.prisma.journalLine.findMany({
      where: {
        accountId: q.accountId,
        journal: {
          status: { in: ["POSTED", "REVERSED"] },
          date: {
            gte: q.from ? new Date(q.from) : undefined,
            lte: q.to ? new Date(q.to) : undefined,
          },
        },
      },
      include: { journal: true, account: true },
      orderBy: { journal: { date: "asc" } },
    });
  }

  @Get("trial-balance")
  @RequirePermission("report.view")
  async trial(@Query() q: { asOf?: string }) {
    const data = await this.accounting.trialBalance(q.asOf ? new Date(q.asOf) : undefined);
    return data.rows;
  }

  @Get("profit-loss")
  @RequirePermission("report.view")
  async pl(@Query() q: { from?: string; to?: string }) {
    const from = q.from ? new Date(q.from) : new Date(new Date().getFullYear(), 0, 1);
    const to = q.to ? new Date(q.to) : new Date();
    return this.accounting.profitLoss(from, to);
  }

  @Get("balance-sheet")
  @RequirePermission("report.view")
  async bs(@Query() q: { asOf?: string }) {
    const tb = await this.trial(q);
    const by = (t: string) => tb.filter((r) => r.type === t);
    const sum = (t: string) =>
      by(t).reduce((s, r) => s + (t === "ASSET" ? r.balance : -r.balance), 0);
    return {
      assets: by("ASSET"),
      liabilities: by("LIABILITY"),
      equity: by("EQUITY"),
      totals: { assets: sum("ASSET"), liabilities: sum("LIABILITY"), equity: sum("EQUITY") },
    };
  }

  @Get("cash-flow")
  @RequirePermission("report.view")
  async cashFlow(@Query() q: { from?: string; to?: string }) {
    const from = q.from ? new Date(q.from) : new Date(new Date().getFullYear(), 0, 1);
    const to = q.to ? new Date(q.to) : new Date();
    const receipts = await this.prisma.receipt.aggregate({ _sum: { amount: true }, where: { date: { gte: from, lte: to } } });
    const payments = await this.prisma.payment.aggregate({ _sum: { amount: true }, where: { date: { gte: from, lte: to } } });
    const expenses = await this.prisma.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: from, lte: to } } });
    const inflows = Number(receipts._sum.amount ?? 0);
    const outflows = Number(payments._sum.amount ?? 0) + Number(expenses._sum.amount ?? 0);
    return { inflows, outflows, net: inflows - outflows };
  }

  @Get("ageing")
  @RequirePermission("report.view")
  async ageing() {
    const bookings = await this.prisma.umrahBooking.findMany({
      where: { balance: { gt: 0 } },
      include: { customer: true },
    });
    const now = Date.now();
    return bookings.map((b) => {
      const days = Math.floor((now - b.createdAt.getTime()) / 86400000);
      const bucket = days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";
      return { bookingNumber: b.bookingNumber, customer: b.customer.fullName, balance: Number(b.balance), days, bucket };
    });
  }

  @Get("customer-ledger/:customerId")
  @RequirePermission("account.view")
  async customerLedger(@Param("customerId") customerId: string) {
    const lines = await this.accounting.partyLedger("customer", customerId);
    return { lines };
  }

  @Get("supplier-ledger/:supplierId")
  @RequirePermission("account.view")
  async supplierLedger(@Param("supplierId") supplierId: string) {
    const lines = await this.accounting.partyLedger("supplier", supplierId);
    return { lines };
  }

  @Get("receivables")
  @RequirePermission("account.view")
  async receivables() {
    return this.accounting.arAp("customer");
  }

  @Get("payables")
  @RequirePermission("account.view")
  async payables() {
    return this.accounting.arAp("supplier");
  }

  @Get("day-book")
  @RequirePermission("account.view")
  async dayBook(@Query() q: { from?: string; to?: string }) {
    return this.prisma.journalEntry.findMany({
      where: {
        status: { in: ["POSTED", "REVERSED"] },
        date: {
          gte: q.from ? new Date(q.from) : undefined,
          lte: q.to ? new Date(q.to) : undefined,
        },
      },
      include: { lines: { include: { account: true } } },
      orderBy: { date: "asc" },
    });
  }

  @Get("openings")
  @RequirePermission("account.view")
  async openings() {
    return this.prisma.journalEntry.findMany({
      where: { kind: "OPENING" },
      include: { lines: { include: { account: true } } },
      orderBy: { date: "desc" },
    });
  }

  @Post("openings")
  @RequirePermission("account.post")
  async createOpening(
    @Body() body: { accountId: string; debit?: number; credit?: number; date?: string; memo?: string },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.accounting.postOpening({
      userId: req.user.id,
      accountId: body.accountId,
      debit: Number(body.debit || 0),
      credit: Number(body.credit || 0),
      date: body.date ? new Date(body.date) : new Date(),
      memo: body.memo,
      branchId: req.user.defaultBranchId,
    });
  }

  @Post("adjustments")
  @RequirePermission("account.post")
  async adjust(
    @Body() body: { memo: string; lines: { accountId: string; debit: number; credit: number }[] },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.accounting.postAdjustment({
      userId: req.user.id,
      memo: body.memo,
      lines: body.lines,
      branchId: req.user.defaultBranchId,
    });
  }

  @Get("invoices")
  @RequirePermission("account.view")
  async invoices() {
    return this.prisma.serviceInvoice.findMany({ include: { customer: true, lines: true }, orderBy: { createdAt: "desc" }, take: 200 });
  }

  @Post("invoices")
  @RequirePermission("account.create")
  async createInvoice(
    @Body() body: {
      customerId?: string;
      notes?: string;
      tax?: number;
      discount?: number;
      lines: { serviceId?: string; description: string; qty?: number; unitPrice: number; cost?: number }[];
    },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.prisma.$transaction(async tx => {
    const lines = body.lines || [];
    if (!lines.length) throw new BadRequestException("Add at least one service line");
    const sellingPrice = lines.reduce((s, l) => s + Number(l.unitPrice || 0) * Number(l.qty || 1), 0);
    const cost = lines.reduce((s, l) => s + Number(l.cost || 0) * Number(l.qty || 1), 0);
    const net = sellingPrice - Number(body.discount || 0) + Number(body.tax || 0);
    const invoiceNumber = await this.seq.next("inv", "INV", tx);
    const rec = await tx.serviceInvoice.create({
      data: {
        invoiceNumber,
        customerId: body.customerId,
        branchId: req.user.defaultBranchId,
        status: "POSTED",
        cost,
        sellingPrice,
        tax: body.tax || 0,
        discount: body.discount || 0,
        net,
        notes: body.notes,
        lines: {
          create: lines.map((l) => ({
            serviceId: l.serviceId,
            description: l.description,
            qty: l.qty || 1,
            unitPrice: l.unitPrice,
            amount: Number(l.unitPrice) * Number(l.qty || 1),
          })),
        },
      },
      include: { lines: true },
    });
    const sale = await this.accounting.postSale({
      db: tx,
      userId: req.user.id,
      module: "service",
      sourceId: rec.id,
      amount: net,
      customerId: rec.customerId,
      branchId: rec.branchId,
      memo: `Service invoice ${rec.invoiceNumber}`,
    });
    if (cost > 0) {
      await this.accounting.postCost({
        db: tx,
        userId: req.user.id,
        module: "service",
        sourceId: rec.id,
        amount: cost,
        branchId: rec.branchId,
        memo: `Service cost ${rec.invoiceNumber}`,
      });
    }
    return tx.serviceInvoice.update({
      where: { id: rec.id },
      data: { journalId: sale?.id },
      include: { lines: true, customer: true },
    });
    });
  }

  @Get("agent-ledger/:agentId")
  @RequirePermission("agent.view")
  async agentLedger(@Param("agentId") agentId: string) {
    const [bookings, commissions, tickets] = await Promise.all([
      this.prisma.umrahBooking.findMany({ where: { agentId } }),
      this.prisma.agentCommission.findMany({ where: { agentId } }),
      this.prisma.ticketSale.findMany({ where: { agentId } }),
    ]);
    return { bookings, commissions, tickets };
  }
}
