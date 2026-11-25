import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { historicalTickets, reviewHistoricalTickets } from "./historical-tickets";
import type { AuthUser } from "../auth/auth.types";

const url = process.env.ZAT_SYNTHETIC_DATABASE_URL;
test("PG17 historical source review preserves ticket accounting and rejects concurrent overwrites", { skip: !url }, async () => {
  const target = new URL(url!);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(target.hostname));
  assert.match(target.pathname, /^\/zat_synthetic_[a-z0-9_]+$/);
  const db = new PrismaClient({ datasourceUrl: target.toString() });
  const hash = "b".repeat(64);
  try {
    const [server] = await db.$queryRaw<{ version: number }[]>`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(server.version >= 170000 && server.version < 180000);
    const user = await db.user.create({ data: { username: randomUUID(), email: `${randomUUID()}@example.test`, fullName: "Synthetic source reviewer", passwordHash: "invalid" } });
    const actor = { id: user.id, isSuperAdmin: true } as AuthUser;
    const source = { supplier: "Synthetic supplier", currency: "PKR", statement_total: "21.25", tickets: [
      { ticket_number: "0000000000001", passenger: "Synthetic Alpha", invoice: "SYN-1", statement_amount: "10.25" },
      { ticket_number: "0000000000002", passenger: "Synthetic Beta", invoice: "SYN-1", statement_amount: "11.00" },
    ] };
    const pnr = await db.pnrRecord.create({ data: { pnr: randomUUID(), passengerCount: 2, status: "HISTORICAL", rawData: { historicalSupplierStatements: { [hash]: source }, unrelated: "preserved" } } });
    const before = { tickets: await db.ticketSale.count(), receipts: await db.receipt.count(), journals: await db.journalEntry.count() };
    const page = await historicalTickets(db as never, actor);
    const group = page.groups.find(g => g.id === pnr.id)!;
    assert.equal(group.statements[0].tickets.length, 2);
    assert.equal(group.statements[0].total, "21.25");
    const attempts = await Promise.allSettled(["First reviewer", "Second reviewer"].map(note => reviewHistoricalTickets(db as never, actor, pnr.id,
      { sourceHash: hash, version: group.version, note, reason: "Synthetic concurrency check" })));
    assert.equal(attempts.filter(r => r.status === "fulfilled").length, 1);
    const failure = attempts.find(r => r.status === "rejected") as PromiseRejectedResult;
    assert.equal(failure.reason.getStatus(), 409);
    assert.equal(await db.auditLog.count({ where: { entityId: pnr.id, action: "REVIEW_HISTORICAL_TICKETS" } }), 1);
    const saved = (await db.pnrRecord.findUniqueOrThrow({ where: { id: pnr.id } }));
    const raw = saved.rawData as Prisma.JsonObject;
    assert.deepEqual((raw.historicalSupplierStatements as Prisma.JsonObject)[hash], source);
    assert.equal(raw.unrelated, "preserved");
    // A missing audit actor must roll back the metadata update too.
    await assert.rejects(reviewHistoricalTickets(db as never, { ...actor, id: "missing-synthetic-actor" }, pnr.id,
      { sourceHash: hash, version: saved.updatedAt.toISOString(), note: "Must roll back", reason: "Synthetic audit failure" }));
    assert.deepEqual((await db.pnrRecord.findUniqueOrThrow({ where: { id: pnr.id } })).rawData, saved.rawData);
    await assert.rejects(historicalTickets(db as never, { ...actor, isSuperAdmin: false, permissions: ["ticket.view"] }), { status: 403 });
    assert.deepEqual({ tickets: await db.ticketSale.count(), receipts: await db.receipt.count(), journals: await db.journalEntry.count() }, before);
  } finally { await db.$disconnect(); }
});
