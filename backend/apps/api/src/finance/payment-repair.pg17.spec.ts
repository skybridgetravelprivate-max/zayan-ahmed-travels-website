import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { PaymentOperations } from "./payment-operations";
import { AccountingService } from "./accounting.service";
import { SequenceService } from "../common/sequence.service";
import { AuditService } from "../common/audit.service";
import { money, paymentMethod } from "./money";
import { financialSummary } from "../dashboard/financial-summary";

test("exact money rejects rounding and unknown methods", () => {
  assert.equal(money("99999999999999.99").toFixed(2), "99999999999999.99");
  for (const value of ["0.001", "-1", "1e3", "10000000000000000.00", "NaN", Infinity, 99999999999999.99]) assert.throws(() => money(value));
  for (const method of ["CARD", "ONLINE", "cash", undefined]) assert.throws(() => paymentMethod(method));
});

const url = process.env.ZAT_SYNTHETIC_DATABASE_URL;
test("PG17 durable supplier payment and exact ledger reconciliation", { skip: !url }, async t => {
  assert.equal(new URL(url!).hostname, "127.0.0.1");
  assert.match(new URL(url!).pathname, /^\/zat_synthetic_/);
  const db = new PrismaClient({ datasourceUrl: url });
  try {
    const [version] = await db.$queryRaw<{ version: number }[]>`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(version.version >= 170000 && version.version < 180000);
    for (const [code, type] of [["1100", "ASSET"], ["1200", "ASSET"], ["1300", "ASSET"], ["2100", "LIABILITY"], ["4400", "REVENUE"]] as const) await db.chartOfAccount.upsert({ where: { code }, create: { code, name: code, type, isPosting: true }, update: {} });
    const branch = await db.branch.create({ data: { code: randomUUID(), name: "Synthetic repair office" } });
    const foreign = await db.branch.create({ data: { code: randomUUID(), name: "Synthetic foreign office" } });
    const supplier = await db.supplier.create({ data: { name: "Synthetic supplier" } });
    const staff = await db.user.create({ data: { email: randomUUID()+"@example.invalid", username: randomUUID(), fullName: "Synthetic", passwordHash: "not-a-real-login" } });
    const user = { id: staff.id, isSuperAdmin: true, branchIds: [branch.id], defaultBranchId: branch.id } as never;
    const seq = new SequenceService(db as never), audit = new AuditService(db as never), accounting = new AccountingService(db as never, seq, audit);
    const operations = new PaymentOperations(db as never, seq, audit, accounting);
    const body = { supplierId: supplier.id, amount: "99999999999999.99", method: "BANK" }, key = randomUUID();
    let first: Awaited<ReturnType<typeof operations.create>>;
    await t.test("concurrent same-key and lost response replay save one exact payment", async () => {
      const results = await Promise.all([operations.create(body, user, key), operations.create(body, user, key)]);
      first = results[0]; assert.equal(first.id, results[1].id); assert.equal(first.amount.toFixed(2), body.amount);
      const restarted = new PaymentOperations(db as never, seq, audit, accounting);
      assert.equal((await restarted.create(body, user, key)).id, first.id);
      assert.equal(await db.payment.count({ where: { supplierId: supplier.id } }), 1);
      const lines = await db.journalLine.findMany({ where: { journalId: first.journalId! } });
      assert.equal(lines[0].debit.plus(lines[1].debit).toFixed(2), body.amount);
      assert.equal(lines[0].credit.plus(lines[1].credit).toFixed(2), body.amount);
    });
    await t.test("new keys/users cannot bypass unreviewed payment; changed payload and unsupported methods deny", async () => {
      await assert.rejects(operations.create(body, user, randomUUID()), { status: 409 });
      await assert.rejects(operations.create(body, { ...(user as object), id: "another-synthetic-user" } as never, randomUUID()), { status: 409 });
      await assert.rejects(operations.create({ ...body, amount: "1.00" }, user, key), { status: 409 });
      for (const method of ["CARD", "ONLINE", "cash"]) await assert.rejects(operations.create({ ...body, method }, user, randomUUID()), { status: 400 });
      await assert.rejects(operations.create(body, { ...(user as object), isSuperAdmin: false } as never, key), { status: 403 });
      await assert.rejects(operations.create(body, user), { status: 400 });
    });
    await t.test("explicit review permits legitimate equal payment under distinct key", async () => {
      await operations.review(first.id, true, user);
      const second = await operations.create(body, user, randomUUID());
      assert.notEqual(second.id, first.id);
      await operations.review(second.id, true, user);
    });
    await t.test("audit failure rolls back journal, payment and sequence", async () => {
      const before = await db.journalEntry.count();
      const failing = new PaymentOperations(db as never, seq, { log: async () => { throw new Error("synthetic audit failure"); } } as never, accounting);
      await assert.rejects(failing.create({ ...body, amount: "1.25" }, user, randomUUID()), /synthetic audit failure/);
      assert.equal(await db.journalEntry.count(), before); assert.equal(await db.payment.count({ where: { supplierId: supplier.id } }), 2);
    });
    await t.test("summary uses scoped posted ledgers and exact movement, ignoring foreign branch", async () => {
      await accounting.postSale({ amount: "100.25", module: "transport", sourceId: randomUUID(), userId: staff.id, branchId: branch.id });
      await accounting.postSale({ amount: "999.99", module: "transport", sourceId: randomUUID(), userId: staff.id, branchId: foreign.id });
      const summary = await financialSummary(db as never, { branchId: branch.id });
      assert.equal(summary.cards.totalReceivable, "100.25");
      assert.equal(summary.cards.totalSales, "100.25");
      assert.equal(summary.cards.bankBalance, "-199999999999999.98");
      assert.equal(summary.cards.totalPayable, "-199999999999999.98");
      await assert.rejects(financialSummary(db as never, { currency: "USD" }), { status: 400 });
    });
  } finally { await db.$disconnect(); }
});
