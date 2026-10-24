import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { CrmService } from "./crm.service";
import { SequenceService } from "../common/sequence.service";
import { AuditService } from "../common/audit.service";
import { AccountingService } from "../finance/accounting.service";
import type { AuthUser } from "../auth/auth.types";

// Opt in only against a disposable local database; never load an application .env.
const url = process.env.ZAT_SYNTHETIC_DATABASE_URL;

test("PG17: direct booking fallback preserves the package budget in quotation lines", { skip: !url }, async () => {
  const target = new URL(url!);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname));
  assert.match(target.pathname, /^\/zat_synthetic_[a-z0-9_]+$/);
  const db = new PrismaClient({ datasourceUrl: url });
  try {
    const [server] = await db.$queryRaw<{ version: number }[]>`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(server.version >= 170000 && server.version < 180000);
    for (const [code, type] of [["1300", "ASSET"], ["4100", "REVENUE"]] as const) {
      await db.chartOfAccount.upsert({ where: { code }, update: {}, create: { code, name: "Synthetic fallback account", type } });
    }
    const branch = await db.branch.create({ data: { code: randomUUID(), name: "Synthetic fallback branch" } });
    const staff = await db.user.create({ data: { email: `${randomUUID()}@example.test`, username: randomUUID(), fullName: "Synthetic fallback staff", passwordHash: "invalid", defaultBranchId: branch.id } });
    const actor = { id: staff.id, branchIds: [branch.id], defaultBranchId: branch.id, isSuperAdmin: false } as AuthUser;
    const seq = new SequenceService(db as never), audit = new AuditService(db as never);
    const accounting = new AccountingService(db as never, seq, audit);
    const crm = new CrmService(db as never, seq, audit, {} as never, {} as never, {} as never, accounting);
    const lead = await db.lead.create({ data: { leadNumber: randomUUID(), fullName: "Synthetic package traveler", mobile: "+923000000000", branchId: branch.id, adults: 3, budget: 120000.03 } });
    const booking = await crm.bookingFromLead(lead.id, actor);
    const quote = await db.quotation.findUniqueOrThrow({ where: { id: booking.quotationId! }, include: { items: true } });
    assert.equal(quote.items.length, 1);
    assert.equal(quote.items[0].quantity, 1);
    assert.equal(quote.items[0].sellingPrice.toFixed(2), "120000.03");
    assert.equal(quote.items[0].sellingPrice.mul(quote.items[0].quantity).toFixed(2), quote.sellingTotal.toFixed(2));
    assert.equal(booking.net.toFixed(2), "120000.03");
    assert.equal((await crm.bookingFromLead(lead.id, actor)).id, booking.id);
    assert.equal(await db.quotationItem.count({ where: { quotationId: quote.id } }), 1);
    assert.equal(await db.umrahBooking.count({ where: { quotationId: quote.id } }), 1);
    const journals = await db.journalEntry.findMany({ where: { sourceId: booking.id }, include: { lines: true } });
    assert.equal(journals.length, 1);
    for (const journal of journals) assert.equal(journal.lines.reduce((sum, line) => sum + Number(line.debit) - Number(line.credit), 0), 0);
  } finally { await db.$disconnect(); }
});
test("PG17: lead package budget agrees with quotation lines and survives recalculation", { skip: !url }, async () => {
  const target = new URL(url!);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname));
  assert.match(target.pathname, /^\/zat_synthetic_[a-z0-9_]+$/);
  const db = new PrismaClient({ datasourceUrl: url });
  try {
    const [server] = await db.$queryRaw<{ version: number }[]>`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(server.version >= 170000 && server.version < 180000, "PostgreSQL 17 required");
    const tag = randomUUID();
    const branch = await db.branch.create({ data: { code: tag, name: "Synthetic branch" } });
    const staff = await db.user.create({ data: {
      email: `${tag}@example.test`, username: tag, fullName: "Synthetic staff",
      passwordHash: "synthetic-invalid", defaultBranchId: branch.id,
    } });
    const actor = { id: staff.id, branchIds: [branch.id], defaultBranchId: branch.id, isSuperAdmin: false } as AuthUser;
    const seq = new SequenceService(db as never);
    const audit = new AuditService(db as never);
    const crm = new CrmService(db as never, seq, audit, {} as never, {} as never, {} as never, {} as never);
    for (const [adults, budget] of [[1, 120000], [3, 120000.03], [4, 0]]) {
      const lead = await db.lead.create({ data: {
        leadNumber: randomUUID(), fullName: "Synthetic traveler", mobile: "+923000000000",
        branchId: branch.id, adults, budget,
      } });
      const quote = await crm.quoteFromLead(lead.id, actor);
      const items = await db.quotationItem.findMany({ where: { quotationId: quote.id } });
      assert.equal(items.reduce((sum, item) => sum + Number(item.sellingPrice) * item.quantity, 0), Number(quote.net));
      assert.equal(Number(quote.net), budget);
      assert.equal((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).status, "QUOTED");
      assert.equal((await db.customer.findUniqueOrThrow({ where: { id: quote.customerId! } })).leadId, lead.id);
      const edited = await crm.updateQuotation(quote.id, actor, { terms: "Synthetic terms" });
      assert.equal(Number(edited.net), budget);
      const added = await crm.addQuoteItem(quote.id, { description: "Synthetic extra", quantity: 2, sellingPrice: 50 });
      assert.equal(Number(added.net), budget + 100);
      const extra = added.items.find(item => item.description === "Synthetic extra")!;
      assert.equal(Number((await crm.removeQuoteItem(quote.id, extra.id)).net), budget);
    }
  } finally {
    await db.$disconnect();
  }
});
