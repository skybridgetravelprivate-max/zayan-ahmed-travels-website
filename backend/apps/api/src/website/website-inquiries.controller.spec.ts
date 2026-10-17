import assert from "node:assert/strict";
import { test } from "node:test";
import { WebsiteInquiriesController } from "./website-inquiries.controller";
import { PrismaService } from "../common/prisma.service";
import { SequenceService } from "../common/sequence.service";

test("website intake rejects missing tokens and invalid input, whitelists fields, and audits atomically", async () => {
  const prior = process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN;
  const token = "test-website-internal-token-at-least-32-characters";
  process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN = token;
  let data: unknown, audits = 0, transactions = 0;
  const db = {
    lead: { create: async (args: { data: unknown }) => { data = args.data; return { id: "lead-id" }; } },
    auditLog: { create: async () => { audits++; } },
  };
  const prisma = { $transaction: async (run: (tx: typeof db) => Promise<unknown>) => { transactions++; return run(db); } };
  const seq = { next: async (_key: string, _prefix: string, tx: unknown) => { assert.equal(tx, db); return "ZAT-LD-1"; } };
  const controller = new WebsiteInquiriesController(prisma as unknown as PrismaService, seq as SequenceService);
  try {
    await assert.rejects(controller.create({}, undefined));
    await assert.rejects(controller.create({ fullName: "Name", mobile: {} }, token));
    assert.equal(transactions, 0);
    assert.deepEqual(await controller.create({ fullName: " Name ", mobile: "+923001234567", email: "name@example.com", notes: "Inquiry", assignedUserId: "attacker", status: "CONFIRMED", source: "OTHER" }, token), { id: "lead-id" });
    assert.deepEqual(data, { leadNumber: "ZAT-LD-1", fullName: "Name", mobile: "+923001234567", email: "name@example.com", notes: "Inquiry", source: "WEBSITE" });
    assert.equal(audits, 1);
    assert.equal(transactions, 1);
  } finally {
    if (prior === undefined) delete process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN;
    else process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN = prior;
  }
});
