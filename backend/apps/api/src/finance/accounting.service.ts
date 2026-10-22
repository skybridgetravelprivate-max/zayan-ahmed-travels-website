import { Injectable, BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { SequenceService } from "../common/sequence.service";
import { AuditService } from "../common/audit.service";

export type JournalLineInput = {
  accountId: string;
  debit: number;
  credit: number;
  memo?: string;
  partyType?: string;
  partyId?: string;
};

export const GL = {
  CASH: "1100",
  BANK: "1200",
  AR: "1300",
  AP: "2100",
  EQUITY: "3100",
  UMRAH: "4100",
  TICKET: "4200",
  HOTEL: "4300",
  TRANSPORT: "4400",
  VISA: "4500",
  SERVICE: "4600",
  COGS: "5100",
  OPEX: "5200",
} as const;

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class AccountingService {
  constructor(
    private prisma: PrismaService,
    private seq: SequenceService,
    private audit: AuditService,
  ) {}

  private store(db?: Db): Db {
    return db ?? this.prisma;
  }

  private async assertPostingAccounts(db: Db, lines: { accountId: string }[]) {
    const ids = [...new Set(lines.map(line => line.accountId))].sort();
    if (!ids.length || ids.some(id => typeof id !== "string" || !id)) throw new BadRequestException("Invalid journal account");
    // Hold eligibility stable until the enclosing posting transaction completes.
    const accounts = await db.$queryRaw<{ id: string; isPosting: boolean; status: string; deletedAt: Date | null }[]>(Prisma.sql`
      SELECT id, "isPosting", status, "deletedAt" FROM "ChartOfAccount"
      WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR SHARE
    `);
    if (accounts.length !== ids.length || accounts.some(a => !a.isPosting || a.status !== "ACTIVE" || a.deletedAt !== null)) {
      throw new BadRequestException("Journal accounts must be active, undeleted posting accounts");
    }
  }

  async accountByCode(code: string, db?: Db) {
    const a = await this.store(db).chartOfAccount.findUnique({ where: { code } });
    if (!a) throw new BadRequestException(`Account ${code} missing`);
    return a;
  }

  moneyAccount(method?: string) {
    return method === "BANK" ? GL.BANK : GL.CASH;
  }

  revenueCode(module?: string) {
    const m = String(module || "").toLowerCase();
    if (m === "umrah") return GL.UMRAH;
    if (m === "ticket" || m === "tickets") return GL.TICKET;
    if (m === "hotel" || m === "reservation" || m === "star") return GL.HOTEL;
    if (m === "transport") return GL.TRANSPORT;
    if (m === "visa") return GL.VISA;
    if (m === "service" || m === "services") return GL.SERVICE;
    return GL.SERVICE;
  }

  async alreadyPosted(module: string, sourceId: string, kind: string, db?: Db) {
    if (!sourceId) return false;
    const hit = await this.store(db).journalEntry.findFirst({
      where: { module, sourceId, kind, status: "POSTED" },
    });
    return Boolean(hit);
  }

  async postJournal(params: {
    date: Date;
    memo: string;
    branchId?: string | null;
    lines: JournalLineInput[];
    userId: string;
    kind?: string;
    module?: string;
    sourceId?: string;
    status?: "DRAFT" | "POSTED";
    db?: Db;
  }): Promise<Prisma.JournalEntryGetPayload<{ include: { lines: true } }>> {
    if (!params.db) return this.prisma.$transaction(tx => this.postJournal({ ...params, db: tx }));
    const db = this.store(params.db);
    const lines = (params.lines || []).map((l) => ({
      ...l,
      debit: Number(l.debit || 0),
      credit: Number(l.credit || 0),
    }));
    if (lines.length < 2) throw new BadRequestException("Journal needs at least two lines");
    for (const l of lines) {
      if (!Number.isFinite(l.debit) || !Number.isFinite(l.credit) || l.debit < 0 || l.credit < 0) throw new BadRequestException("Debit and credit cannot be negative");
      if (l.debit > 0 && l.credit > 0) throw new BadRequestException("A line cannot be both debit and credit");
      if (l.debit === 0 && l.credit === 0) throw new BadRequestException("Each line needs a debit or a credit");
    }
    const debit = lines.reduce((s, l) => s + l.debit, 0);
    const credit = lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(debit - credit) > 0.009) throw new BadRequestException("Journal is not balanced");
    const status = params.status || "POSTED";
    await this.assertPostingAccounts(db, lines);
    const entryNumber = await this.seq.next("jv", "ZAT-JV", db);
    const entry = await db.journalEntry.create({
      data: {
        entryNumber,
        date: params.date,
        memo: params.memo,
        status,
        kind: params.kind || "MANUAL",
        module: params.module,
        sourceId: params.sourceId,
        postedAt: status === "POSTED" ? new Date() : null,
        branchId: params.branchId,
        lines: { create: lines },
      },
      include: { lines: true },
    });
    await this.audit.log({ userId: params.userId, action: status === "POSTED" ? "POST" : "CREATE", entity: "journalEntry", entityId: entry.id, db });
    return entry;
  }

  async postExisting(id: string, userId: string) {
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "JournalEntry" WHERE id = ${id} FOR UPDATE`;
      const j = await tx.journalEntry.findUnique({ where: { id }, include: { lines: true } });
      if (!j || j.status !== "DRAFT") throw new BadRequestException("Only draft journals can be posted");
      const debit = j.lines.reduce((sum, line) => sum + Number(line.debit), 0);
      const credit = j.lines.reduce((sum, line) => sum + Number(line.credit), 0);
      if (j.lines.length < 2 || !Number.isFinite(debit) || !Number.isFinite(credit) || debit <= 0 || Math.abs(debit - credit) > 0.009) throw new BadRequestException("Journal is not balanced");
      await this.assertPostingAccounts(tx, j.lines);
      const claimed = await tx.journalEntry.updateMany({ where: { id, status: "DRAFT" }, data: { status: "POSTED", postedAt: new Date() } });
      if (claimed.count !== 1) throw new BadRequestException("Journal status changed");
      await this.audit.log({ userId, action: "POST", entity: "journalEntry", entityId: id, db: tx });
      return tx.journalEntry.findUnique({ where: { id } });
    });
  }

  async reverse(id: string, userId: string) {
    return this.prisma.$transaction(async tx => {
    const j = await tx.journalEntry.findUnique({ where: { id }, include: { lines: true } });
    if (!j || j.status !== "POSTED") throw new BadRequestException("Only posted journals can be reversed");
    if (!["MANUAL", "OPENING", "ADJUSTMENT"].includes(j.kind)) throw new BadRequestException("Use the source module refund or cancellation workflow for business journals");
    const claimed = await tx.journalEntry.updateMany({ where: { id, status: "POSTED" }, data: { status: "REVERSED" } });
    if (claimed.count !== 1) throw new BadRequestException("Journal already reversed");
    const rev = await this.postJournal({
      db: tx,
      date: new Date(),
      memo: `Reversal of ${j.entryNumber}`,
      branchId: j.branchId,
      userId,
      kind: "REVERSAL",
      module: j.module || undefined,
      sourceId: j.sourceId || undefined,
      lines: j.lines.map((l) => ({
        accountId: l.accountId,
        debit: Number(l.credit),
        credit: Number(l.debit),
        memo: "Reversal",
        partyType: l.partyType || undefined,
        partyId: l.partyId || undefined,
      })),
    });
    await tx.journalEntry.update({ where: { id }, data: { status: "REVERSED", reversedOfId: rev.id } });
    return rev;
    });
  }

  async postSale(opts: {
    userId: string;
    module: string;
    sourceId: string;
    amount: number;
    customerId?: string | null;
    branchId?: string | null;
    date?: Date;
    memo?: string;
    db?: Db;
  }) {
    const amount = Number(opts.amount || 0);
    if (amount <= 0) return null;
    if (await this.alreadyPosted(opts.module, opts.sourceId, "SALE", opts.db)) return null;
    const ar = await this.accountByCode(GL.AR, opts.db);
    const rev = await this.accountByCode(this.revenueCode(opts.module), opts.db);
    return this.postJournal({
      date: opts.date || new Date(),
      memo: opts.memo || `${opts.module} sale`,
      branchId: opts.branchId,
      userId: opts.userId,
      kind: "SALE",
      module: opts.module,
      sourceId: opts.sourceId,
      db: opts.db,
      lines: [
        { accountId: ar.id, debit: amount, credit: 0, partyType: "customer", partyId: opts.customerId || undefined },
        { accountId: rev.id, debit: 0, credit: amount },
      ],
    });
  }

  async postCost(opts: {
    userId: string;
    module: string;
    sourceId: string;
    amount: number;
    supplierId?: string | null;
    branchId?: string | null;
    date?: Date;
    memo?: string;
    db?: Db;
  }) {
    const amount = Number(opts.amount || 0);
    if (amount <= 0) return null;
    if (await this.alreadyPosted(opts.module, opts.sourceId, "COST", opts.db)) return null;
    const cogs = await this.accountByCode(GL.COGS, opts.db);
    const ap = await this.accountByCode(GL.AP, opts.db);
    return this.postJournal({
      date: opts.date || new Date(),
      memo: opts.memo || `${opts.module} cost`,
      branchId: opts.branchId,
      userId: opts.userId,
      kind: "COST",
      module: opts.module,
      sourceId: opts.sourceId,
      db: opts.db,
      lines: [
        { accountId: cogs.id, debit: amount, credit: 0 },
        { accountId: ap.id, debit: 0, credit: amount, partyType: "supplier", partyId: opts.supplierId || undefined },
      ],
    });
  }

  async postReceipt(opts: {
    userId: string;
    db?: Db;
    amount: number;
    method?: string;
    customerId?: string | null;
    branchId?: string | null;
    date?: Date;
    memo?: string;
    sourceId?: string;
    module?: string;
  }) {
    const amount = Number(opts.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException("Receipt amount must be positive");
    const cash = await this.accountByCode(this.moneyAccount(opts.method), opts.db);
    const ar = await this.accountByCode(GL.AR, opts.db);
    return this.postJournal({
      db: opts.db,
      date: opts.date || new Date(),
      memo: opts.memo || "Customer receipt",
      branchId: opts.branchId,
      userId: opts.userId,
      kind: "RECEIPT",
      module: opts.module || "accounts",
      sourceId: opts.sourceId,
      lines: [
        { accountId: cash.id, debit: amount, credit: 0 },
        { accountId: ar.id, debit: 0, credit: amount, partyType: "customer", partyId: opts.customerId || undefined },
      ],
    });
  }

  async postPayment(opts: {
    userId: string;
    db?: Db;
    amount: number;
    method?: string;
    supplierId?: string | null;
    branchId?: string | null;
    date?: Date;
    memo?: string;
    sourceId?: string;
    module?: string;
  }) {
    const amount = Number(opts.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException("Payment amount must be positive");
    const cash = await this.accountByCode(this.moneyAccount(opts.method), opts.db);
    const ap = await this.accountByCode(GL.AP, opts.db);
    return this.postJournal({
      db: opts.db,
      date: opts.date || new Date(),
      memo: opts.memo || "Supplier payment",
      branchId: opts.branchId,
      userId: opts.userId,
      kind: "PAYMENT",
      module: opts.module || "accounts",
      sourceId: opts.sourceId,
      lines: [
        { accountId: ap.id, debit: amount, credit: 0, partyType: "supplier", partyId: opts.supplierId || undefined },
        { accountId: cash.id, debit: 0, credit: amount },
      ],
    });
  }

  async postRefund(opts: {
    userId: string;
    amount: number;
    module: string;
    sourceId: string;
    customerId?: string | null;
    branchId?: string | null;
    date?: Date;
    memo?: string;
    db?: Db;
  }) {
    const amount = Number(opts.amount || 0);
    if (amount <= 0) throw new BadRequestException("Refund amount must be positive");
    const ar = await this.accountByCode(GL.AR, opts.db);
    const rev = await this.accountByCode(this.revenueCode(opts.module), opts.db);
    return this.postJournal({
      date: opts.date || new Date(),
      memo: opts.memo || `${opts.module} refund`,
      branchId: opts.branchId,
      userId: opts.userId,
      kind: "REFUND",
      db: opts.db,
      module: opts.module,
      sourceId: opts.sourceId,
      lines: [
        { accountId: rev.id, debit: amount, credit: 0 },
        { accountId: ar.id, debit: 0, credit: amount, partyType: "customer", partyId: opts.customerId || undefined },
      ],
    });
  }

  async postOpening(opts: {
    userId: string;
    accountId: string;
    debit: number;
    credit: number;
    date?: Date;
    memo?: string;
    branchId?: string | null;
  }) {
    const debit = Number(opts.debit || 0);
    const credit = Number(opts.credit || 0);
    if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
      throw new BadRequestException("Opening needs a debit or a credit, not both");
    }
    const equity = await this.accountByCode(GL.EQUITY);
    return this.postJournal({
      date: opts.date || new Date(),
      memo: opts.memo || "Opening balance",
      branchId: opts.branchId,
      userId: opts.userId,
      kind: "OPENING",
      module: "accounts",
      sourceId: opts.accountId,
      lines: debit > 0
        ? [
            { accountId: opts.accountId, debit, credit: 0, memo: "Opening" },
            { accountId: equity.id, debit: 0, credit: debit, memo: "Opening equity" },
          ]
        : [
            { accountId: equity.id, debit: credit, credit: 0, memo: "Opening equity" },
            { accountId: opts.accountId, debit: 0, credit, memo: "Opening" },
          ],
    });
  }

  async postAdjustment(opts: {
    userId: string;
    lines: JournalLineInput[];
    memo: string;
    branchId?: string | null;
    date?: Date;
  }) {
    return this.postJournal({
      date: opts.date || new Date(),
      memo: opts.memo,
      branchId: opts.branchId,
      userId: opts.userId,
      kind: "ADJUSTMENT",
      module: "accounts",
      lines: opts.lines,
    });
  }

  async postExpense(opts: {
    userId: string;
    db?: Db;
    amount: number;
    category?: string;
    branchId?: string | null;
    date?: Date;
  }) {
    const amount = Number(opts.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException("Expense amount must be positive");
    const exp = await this.accountByCode(GL.OPEX, opts.db);
    const cash = await this.accountByCode(GL.CASH, opts.db);
    return this.postJournal({
      db: opts.db,
      date: opts.date || new Date(),
      memo: opts.category || "Expense",
      branchId: opts.branchId,
      userId: opts.userId,
      kind: "EXPENSE",
      module: "accounts",
      lines: [
        { accountId: exp.id, debit: amount, credit: 0 },
        { accountId: cash.id, debit: 0, credit: amount },
      ],
    });
  }

  async trialBalance(asOf?: Date) {
    const accounts = await this.prisma.chartOfAccount.findMany({ where: { isPosting: true, deletedAt: null }, orderBy: { code: "asc" } });
    const cutoff = asOf || new Date();
    const rows = [];
    for (const a of accounts) {
      const agg = await this.prisma.journalLine.aggregate({
        where: { accountId: a.id, journal: { status: { in: ["POSTED", "REVERSED"] }, date: { lte: cutoff } } },
        _sum: { debit: true, credit: true },
      });
      const debit = Number(agg._sum.debit ?? 0);
      const credit = Number(agg._sum.credit ?? 0);
      rows.push({ code: a.code, name: a.name, type: a.type, debit, credit, balance: debit - credit });
    }
    const totDr = rows.reduce((s, r) => s + r.debit, 0);
    const totCr = rows.reduce((s, r) => s + r.credit, 0);
    return { rows, totals: { debit: totDr, credit: totCr, balanced: Math.abs(totDr - totCr) < 0.009 } };
  }

  async profitLoss(from: Date, to: Date) {
    const accounts = await this.prisma.chartOfAccount.findMany({ where: { type: { in: ["REVENUE", "EXPENSE"] }, deletedAt: null } });
    const rows = [];
    for (const a of accounts) {
      const agg = await this.prisma.journalLine.aggregate({
        where: { accountId: a.id, journal: { status: { in: ["POSTED", "REVERSED"] }, date: { gte: from, lte: to } } },
        _sum: { debit: true, credit: true },
      });
      const debit = Number(agg._sum.debit ?? 0);
      const credit = Number(agg._sum.credit ?? 0);
      rows.push({
        code: a.code,
        name: a.name,
        type: a.type,
        amount: a.type === "REVENUE" ? credit - debit : debit - credit,
      });
    }
    const income = rows.filter((r) => r.type === "REVENUE").reduce((s, r) => s + r.amount, 0);
    const expense = rows.filter((r) => r.type === "EXPENSE").reduce((s, r) => s + r.amount, 0);
    return { rows, income, expense, net: income - expense };
  }

  async partyLedger(partyType: string, partyId: string) {
    const lines = await this.prisma.journalLine.findMany({
      where: { partyType, partyId, journal: { status: { in: ["POSTED", "REVERSED"] } } },
      include: { journal: true, account: true },
      orderBy: { journal: { date: "asc" } },
    });
    let run = 0;
    return lines.map((l) => {
      run += Number(l.debit) - Number(l.credit);
      return {
        date: l.journal.date,
        entryNumber: l.journal.entryNumber,
        memo: l.memo || l.journal.memo,
        account: l.account.code,
        debit: Number(l.debit),
        credit: Number(l.credit),
        running: run,
      };
    });
  }

  async arAp(partyType: "customer" | "supplier") {
    const arApCode = partyType === "customer" ? GL.AR : GL.AP;
    const acc = await this.accountByCode(arApCode);
    const lines = await this.prisma.journalLine.findMany({
      where: { accountId: acc.id, partyType, journal: { status: { in: ["POSTED", "REVERSED"] } } },
    });
    const map: Record<string, number> = {};
    for (const l of lines) {
      const id = l.partyId || "unknown";
      map[id] = (map[id] || 0) + Number(l.debit) - Number(l.credit);
    }
    return Object.entries(map)
      .map(([partyId, balance]) => ({ partyId, balance: partyType === "supplier" ? -balance : balance }))
      .filter((r) => Math.abs(r.balance) > 0.009);
  }
}
