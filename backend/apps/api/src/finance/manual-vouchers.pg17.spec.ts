import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { postCashVoucher, postManualVoucher } from "./manual-vouchers";
import { AccountingService } from "./accounting.service";
import { SequenceService } from "../common/sequence.service";
import { AuditService } from "../common/audit.service";
import type { AuthUser } from "../auth/auth.types";

test("PG17 manual vouchers serialize retries, preserve exact cents and roll back failed audit", { skip: !process.env.ZAT_SYNTHETIC_DATABASE_URL }, async () => {
  const target = new URL(process.env.ZAT_SYNTHETIC_DATABASE_URL!);
  assert.equal(target.hostname, "127.0.0.1");
  assert.match(target.pathname, /^\/zat_synthetic_[a-z0-9_]+$/);
  const db = new PrismaClient({ datasourceUrl: target.toString() });
  try {
    const [server] = await db.$queryRaw<{ version: number }[]>`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(server.version >= 170000 && server.version < 180000);
    const tag = randomUUID();
    const branch = await db.branch.create({ data: { code: tag, name: "Synthetic voucher branch" } });
    const staff = await db.user.create({ data: { username: tag, email: tag + "@example.invalid", fullName: "Synthetic voucher operator", passwordHash: "invalid" } });
    const user = { id: staff.id, isSuperAdmin: true, defaultBranchId: branch.id } as AuthUser;
    const a = await db.chartOfAccount.create({ data: { code: "VA-" + tag, name: "Synthetic voucher asset", type: "ASSET" } });
    const b = await db.chartOfAccount.create({ data: { code: "VE-" + tag, name: "Synthetic voucher equity", type: "EQUITY" } });
    const ar = await db.chartOfAccount.upsert({ where: { code: "1300" }, update: {}, create: { code: "1300", name: "Synthetic receivables", type: "ASSET" } });
    const foreign = await db.branch.create({ data: { code: randomUUID(), name: "Synthetic foreign voucher branch" } });
    const customer = await db.customer.create({ data: { customerNumber: tag, fullName: "Synthetic foreign voucher customer", branchId: foreign.id } });
    const audit = new AuditService(db as never), seq = new SequenceService(db as never), accounting = new AccountingService(db as never, seq, audit);
    const body = { date: "2035-01-02", memo: "Synthetic voucher", lines: [{ accountId: a.id, debit: "100.25", credit: "0" }, { accountId: b.id, debit: "0", credit: "100.25" }] };
    const key = randomUUID();
    const count = await db.journalEntry.count({ where: { branchId: branch.id } });
    const results = await Promise.all(Array.from({ length: 4 }, () => postManualVoucher(db as never, accounting, audit, user, body, key)));
    assert.equal(new Set(results.map(r => r.id)).size, 1);
    assert.equal(await db.journalEntry.count({ where: { branchId: branch.id } }), count + 1);
    assert.equal(results[0].lines[0].debit.plus(results[0].lines[1].debit).toFixed(2), "100.25");
    await assert.rejects(postManualVoucher(db as never, accounting, audit, user, { ...body, memo: "Changed" }, key), { status: 409 });
    await db.auditLog.delete({ where: { id: results[0].id } });
    await assert.rejects(postManualVoucher(db as never, accounting, audit, user, body, key), { status: 409 });
    assert.equal(await db.journalEntry.count({ where: { branchId: branch.id } }), count + 1);
    await assert.rejects(postManualVoucher(db as never, accounting, audit, user, { ...body, lines: [{ accountId: ar.id, debit: "100.25", credit: "0", partyType: "customer", partyId: customer.id }, body.lines[1]] }, randomUUID()), { status: 404 });
    const failing = { log: async () => { throw new Error("Synthetic audit failure"); } } as unknown as AuditService;
    await assert.rejects(postManualVoucher(db as never, accounting, failing, user, body, randomUUID()), /Synthetic audit failure/);
    assert.equal(await db.journalEntry.count({ where: { branchId: branch.id } }), count + 1);
    await db.chartOfAccount.update({ where: { id: a.id }, data: { status: "INACTIVE" } });
    await assert.rejects(postManualVoucher(db as never, accounting, audit, user, body, randomUUID()), { status: 400 });
    assert.equal(await db.journalEntry.count({ where: { branchId: branch.id } }), count + 1);
    const cash = await db.chartOfAccount.upsert({ where: { code: "1100" }, update: {}, create: { code: "1100", name: "Synthetic cash", type: "ASSET" } });
    const cashBody = { date: "2035-01-02", memo: "Synthetic gross cash", lines: [{ accountId: b.id, debit: "10.25", credit: "0" }, { accountId: b.id, debit: "0", credit: "10.25" }] };
    const cashKey = randomUUID();
    const cashResults = await Promise.all(Array.from({ length: 4 }, () => postCashVoucher(db as never, accounting, audit, user, cashBody, cashKey)));
    assert.equal(new Set(cashResults.map(r => r.id)).size, 1);
    const cashLines = cashResults[0].lines.filter(l => l.accountId === cash.id);
    assert.equal(cashLines.length, 2);
    assert.deepEqual(cashLines.map(l => l.debit.toFixed(2)).sort(), ["0.00", "10.25"]);
    assert.deepEqual(cashLines.map(l => l.credit.toFixed(2)).sort(), ["0.00", "10.25"]);
    await assert.rejects(postCashVoucher(db as never, accounting, audit, user, { ...cashBody, memo: "Changed" }, cashKey), { status: 409 });
    await db.chartOfAccount.update({ where: { id: cash.id }, data: { status: "INACTIVE" } });
    try {
      assert.equal((await postCashVoucher(db as never, accounting, audit, user, cashBody, cashKey)).id, cashResults[0].id);
      await assert.rejects(postCashVoucher(db as never, accounting, audit, user, cashBody, randomUUID()), { status: 400 });
    } finally { await db.chartOfAccount.update({ where: { id: cash.id }, data: { status: "ACTIVE" } }); }
  } finally { await db.$disconnect(); }
});

