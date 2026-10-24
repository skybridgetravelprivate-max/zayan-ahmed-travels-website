import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { FinanceController } from "./finance.controller";
import { AccountingService } from "./accounting.service";
import { AuditService } from "../common/audit.service";
import { SequenceService } from "../common/sequence.service";

const url = process.env.ZAT_SYNTHETIC_DATABASE_URL;
test("PG17 receipt recovery cannot be bypassed by another tab, key or staff user", { skip: !url }, async t => {
  const target = new URL(url!);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname));
  assert.match(target.pathname, /^\/zat_synthetic_[a-z0-9_]+$/);
  const db = new PrismaClient({ datasourceUrl: url });
  try {
    const [server] = await db.$queryRaw<{ version: number }[]>`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(server.version >= 170000 && server.version < 180000);
    for (const code of ["1100", "1300", "4100"]) await db.chartOfAccount.upsert({ where: { code }, update: {}, create: { code, name: "Synthetic account", type: code === "4100" ? "REVENUE" : "ASSET" } });
    const branch = await db.branch.create({ data: { code: randomUUID(), name: "Synthetic recovery branch" } });
    const staff = await db.user.create({ data: { email: `${randomUUID()}@example.test`, username: randomUUID(), fullName: "Synthetic recovery staff", passwordHash: "invalid" } });
    const second = await db.user.create({ data: { email: `${randomUUID()}@example.test`, username: randomUUID(), fullName: "Other synthetic staff", passwordHash: "invalid" } });
    const customer = await db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Synthetic recovery customer", branchId: branch.id } });
    const booking = await db.umrahBooking.create({ data: { bookingNumber: randomUUID(), customerId: customer.id, branchId: branch.id, net: 1000, sellingPrice: 1000, balance: 1000 } });
    const req = { user: { id: staff.id, isSuperAdmin: true, branchIds: [branch.id], defaultBranchId: branch.id } } as never;
    const otherReq = { user: { id: second.id, isSuperAdmin: true, branchIds: [branch.id], defaultBranchId: branch.id } } as never;
    const seq = new SequenceService(db as never), audit = new AuditService(db as never);
    const accounting = new AccountingService(db as never, seq, audit);
    const finance = new FinanceController(db as never, seq, audit, accounting);
    await accounting.postSale({ userId: staff.id, module: "umrah", sourceId: booking.id, amount: 1000, customerId: customer.id, branchId: branch.id });
    const body = { bookingId: booking.id, amount: 100, method: "CASH" }, key = randomUUID();
    const receipt = await finance.createReceipt(body, req, key);
    await t.test("same key replays across controller restart, while new keys/users and missing keys cannot duplicate", async () => {
      const restarted = new FinanceController(db as never, seq, audit, accounting);
      assert.equal((await restarted.createReceipt(body, req, key)).id, receipt.id);
      await assert.rejects(restarted.createReceipt(body, req, randomUUID()), { status: 409 });
      await assert.rejects(restarted.createReceipt(body, otherReq, randomUUID()), { status: 409 });
      await assert.rejects(restarted.createReceipt(body, req), { status: 400 });
      await assert.rejects(restarted.createReceipt({ ...body, amount: 101 }, req, key), { status: 409 });
      assert.equal(await db.receipt.count({ where: { bookingId: booking.id } }), 1);
    });
    await t.test("recovery lookup is scoped to the submitting staff user", async () => {
      assert.equal((await finance.receiptSubmission(key, req)).id, receipt.id);
      await assert.rejects(finance.receiptSubmission(key, otherReq), { status: 404 });
    });
    await t.test("review requires acknowledgement and rolls back on audit failure", async () => {
      await assert.rejects(finance.reviewReceipt(receipt.id, {}, req), { status: 400 });
      const broken = new FinanceController(db as never, seq, { log: async () => { throw Error("synthetic review failure"); } } as never, accounting);
      await assert.rejects(broken.reviewReceipt(receipt.id, { reviewed: true }, req), /synthetic review failure/);
      await assert.rejects(finance.createReceipt(body, req, randomUUID()), { status: 409 });
      assert.equal(await db.auditLog.count({ where: { entityId: receipt.id, action: "REVIEW_RECEIPT" } }), 0);
    });
    await t.test("explicit review is idempotent and permits one new intentional payment", async () => {
      await Promise.all([finance.reviewReceipt(receipt.id, { reviewed: true }, req), finance.reviewReceipt(receipt.id, { reviewed: true }, req)]);
      assert.equal(await db.auditLog.count({ where: { entityId: receipt.id, action: "REVIEW_RECEIPT" } }), 1);
      const outcomes = await Promise.allSettled([finance.createReceipt(body, req, randomUUID()), finance.createReceipt(body, req, randomUUID())]);
      assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
      assert.equal(await db.receipt.count({ where: { bookingId: booking.id } }), 2);
      assert.equal((await finance.createReceipt(body, req, key)).id, receipt.id);
      const current = await db.umrahBooking.findUniqueOrThrow({ where: { id: booking.id } });
      assert.equal(current.paid.toFixed(2), "200.00"); assert.equal(current.balance.toFixed(2), "800.00");
    });
  } finally { await db.$disconnect(); }
});
