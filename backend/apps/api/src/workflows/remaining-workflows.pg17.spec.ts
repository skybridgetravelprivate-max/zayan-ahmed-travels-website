import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient, Prisma } from "@prisma/client";
import { WorkflowsController } from "./workflows.controller";
import { AccountingService } from "../finance/accounting.service";
import { SequenceService } from "../common/sequence.service";
import { AuditService } from "../common/audit.service";
import { ReportsService } from "../reports/reports.service";
import type { AuthUser } from "../auth/auth.types";

const url = process.env.ZAT_SYNTHETIC_DATABASE_URL;
test("PG17: ticket replacement preserves payments and reconciles customer accounting", { skip: !url }, async t => {
  const target = new URL(url!);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname));
  assert.match(target.pathname, /^\/zat_synthetic_[a-z0-9_]+$/);
  const db = new PrismaClient({ datasourceUrl: url });
  try {
    const [server] = await db.$queryRaw<{ version: number }[]>`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(server.version >= 170000 && server.version < 180000);
    for (const [code, type] of [["1100", "ASSET"], ["1300", "ASSET"], ["4200", "REVENUE"]] as const) {
      await db.chartOfAccount.upsert({ where: { code }, update: {}, create: { code, name: "Synthetic workflow account", type } });
    }
    const branch = await db.branch.create({ data: { code: randomUUID(), name: "Synthetic replacement branch" } });
    const staff = await db.user.create({ data: { email: `${randomUUID()}@example.test`, username: randomUUID(), fullName: "Synthetic replacement staff", passwordHash: "invalid", defaultBranchId: branch.id } });
    const customer = await db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Synthetic replacement traveler", branchId: branch.id } });
    const supplier = await db.supplier.create({ data: { name: "Synthetic airline supplier" } });
    const actor = { id: staff.id, branchIds: [branch.id], defaultBranchId: branch.id, isSuperAdmin: true } as AuthUser;
    const req = { user: actor } as never;
    const seq = new SequenceService(db as never), audit = new AuditService(db as never);
    const accounting = new AccountingService(db as never, seq, audit);
    const workflow = new WorkflowsController(db as never, seq, audit, accounting, {} as never);
    const ticket = await db.ticketSale.create({ data: { ticketNumber: randomUUID(), customerId: customer.id, supplierId: supplier.id, branchId: branch.id, fare: "100.03", net: "100.03", cost: "60", profit: "40.03", paidAmount: "40.01", status: "ISSUED", paymentStatus: "PARTIAL", sector: "ISB-JED", departureAt: new Date("2050-01-01"), exchangeRate: "1.5", baggage: "20kg" } });
    await accounting.postSale({ userId: staff.id, module: "ticket", sourceId: ticket.id, customerId: customer.id, branchId: branch.id, amount: 100.03 });
    await accounting.postReceipt({ userId: staff.id, module: "ticket", sourceId: ticket.id, customerId: customer.id, branchId: branch.id, amount: 40.01, method: "CASH" });
    let replacement: Awaited<ReturnType<typeof workflow.reissue>>;
    await t.test("reissue retains paid amount, itinerary context and decimal fees with customer-tagged AR", async () => {
      replacement = await workflow.reissue(ticket.id, { newTicketNumber: randomUUID(), newItinerary: "ISB-MED", airlineChangeFee: 0.1, agencyFee: 0.2, fareDifference: 0.3 }, req);
      assert.equal(replacement.newTicket.paidAmount.toFixed(2), "40.01");
      assert.equal(replacement.newTicket.net.toFixed(2), "100.63");
      assert.equal(replacement.newTicket.paymentStatus, "PARTIAL");
      assert.equal(replacement.newTicket.supplierId, supplier.id);
      assert.equal(replacement.newTicket.departureAt?.toISOString(), ticket.departureAt?.toISOString());
      assert.equal(replacement.newTicket.sector, "ISB-MED");
      assert.equal(replacement.newTicket.exchangeRate.toString(), "1.5");
      const rows = await accounting.arAp("customer");
      assert.equal(rows.find(r => r.partyId === customer.id)?.balance, 60.62);
    });
    await t.test("replaced ticket cannot be refunded again and a refunded replacement cannot be reissued blindly", async () => {
      await assert.rejects(workflow.refund(ticket.id, { refundAmount: 5, reason: "Synthetic" }, req));
      await workflow.refund(replacement!.newTicket.id, { refundAmount: 5, reason: "Synthetic credit" }, req);
      await assert.rejects(workflow.reissue(replacement!.newTicket.id, { agencyFee: 1 }, req), { status: 409 });
      const report = await new ReportsService(db as never, accounting).run("receivables", {});
      assert.equal(report.rows.find(r => r.clientId === customer.id)?.debit, 55.62);
    });
    await t.test("concurrent reissues create only one replacement and unpaid originals stay unpaid", async () => {
      const original = await db.ticketSale.create({ data: { customerId: customer.id, branchId: branch.id, fare: 5, net: 5, cost: 0, profit: 5, status: "ISSUED" } });
      const results = await Promise.allSettled([workflow.reissue(original.id, { agencyFee: 1 }, req), workflow.reissue(original.id, { agencyFee: 1 }, req)]);
      assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
      assert.equal(await db.ticketReissue.count({ where: { originalTicketId: original.id } }), 1);
      const success = results.find(r => r.status === "fulfilled");
      if (success?.status === "fulfilled") assert.equal(success.value.newTicket.paymentStatus, "UNPAID");
    });
    await t.test("failed audit rolls back replacement, fee journal and original status", async () => {
      const original = await db.ticketSale.create({ data: { customerId: customer.id, branchId: branch.id, fare: 7, net: 7, cost: 0, profit: 7, status: "ISSUED" } });
      const before = await db.journalEntry.count();
      const failing = new WorkflowsController(db as never, seq, { log: async () => { throw Error("synthetic audit failure"); } } as never, accounting, {} as never);
      await assert.rejects(failing.reissue(original.id, { agencyFee: 1 }, req), /synthetic audit failure/);
      assert.equal(await db.ticketReissue.count({ where: { originalTicketId: original.id } }), 0);
      assert.equal((await db.ticketSale.findUniqueOrThrow({ where: { id: original.id } })).status, "ISSUED");
      assert.equal(await db.journalEntry.count(), before);
    });
    await t.test("foreign branch reissue is denied without creating another ticket", async () => {
      const original = await db.ticketSale.create({ data: { customerId: customer.id, branchId: branch.id, net: 2, status: "ISSUED" } });
      const foreign = { user: { ...actor, isSuperAdmin: false, branchIds: [], defaultBranchId: null } } as never;
      await assert.rejects(workflow.reissue(original.id, { agencyFee: 1 }, foreign));
      assert.equal(await db.ticketReissue.count({ where: { originalTicketId: original.id } }), 0);
    });
    await t.test("all workflow journals remain balanced", async () => {
      const journals = await db.journalEntry.findMany({ where: { branchId: branch.id }, include: { lines: true } });
      for (const journal of journals) assert.equal(journal.lines.reduce((sum, line) => sum.plus(line.debit).minus(line.credit), new Prisma.Decimal(0)).toFixed(2), "0.00");
    });
  } finally { await db.$disconnect(); }
});
