import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { CrmService } from "./crm.service";
import { CrmScopeGuard } from "./crm-scope.guard";
import { ResourcesService } from "../resources/resources.service";
import { AuditService } from "../common/audit.service";
import { SequenceService } from "../common/sequence.service";
import { NotifyService } from "../common/notify.service";
import type { AuthUser } from "../auth/auth.types";

const url = process.env.ZAT_SYNTHETIC_DATABASE_URL;
test("PG17 CRM operations: scope, truthful queues, durable follow-ups and atomic batch authority", { skip: !url }, async t => {
  const target = new URL(url!);
  assert.equal(target.hostname, "127.0.0.1");
  assert.match(target.pathname, /^\/zat_synthetic_crm_[a-z0-9_]+$/);
  const db = new PrismaClient({ datasourceUrl: url });
  try {
    const [server] = await db.$queryRaw<{ version: number }[]>`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(server.version >= 170000 && server.version < 180000);
    const a = await db.branch.create({ data: { code: randomUUID(), name: "Synthetic A" } });
    const b = await db.branch.create({ data: { code: randomUUID(), name: "Synthetic B" } });
    const staff = await db.user.create({ data: { username: randomUUID(), email: `${randomUUID()}@example.test`, fullName: "Synthetic CRM reviewer", passwordHash: "invalid-synthetic-only", defaultBranchId: a.id } });
    const foreign = await db.user.create({ data: { username: randomUUID(), email: `${randomUUID()}@example.test`, fullName: "Synthetic foreign reviewer", passwordHash: "invalid-synthetic-only", defaultBranchId: b.id } });
    const actor: AuthUser = { id: staff.id, email: staff.email, username: staff.username, fullName: staff.fullName, branchIds: [a.id], defaultBranchId: a.id, roleNames: [], isSuperAdmin: false, permissions: ["lead.view", "lead.edit", "lead.assign", "lead.delete", "followup.view", "followup.create", "followup.edit", "followup.delete", "task.view", "task.create", "task.edit", "quotation.view"] };
    const seq = new SequenceService(db as never), audit = new AuditService(db as never);
    const crm = new CrmService(db as never, seq, audit, new NotifyService(db as never), { send: async () => ({ skipped: true }) } as never, { send: async () => ({ skipped: true }) } as never, {} as never);
    const resources = new ResourcesService(db as never, seq, audit);
    const lead = (branchId = a.id) => db.lead.create({ data: { leadNumber: randomUUID(), fullName: "Synthetic inquiry", mobile: "+0000000000", branchId } });
    const customer = await db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Synthetic customer without lead", branchId: a.id } });
    const yesterday = new Date(Date.now() - 2 * 86400000), first = new Date(Date.now() + 86400000), later = new Date(Date.now() + 3 * 86400000);
    const localLead = await lead(), foreignLead = await lead(b.id);
    const localFollow = await db.followUp.create({ data: { leadId: localLead.id, dueAt: yesterday, subject: "Local due work" } });
    await db.followUp.create({ data: { leadId: foreignLead.id, dueAt: yesterday, subject: "Foreign due work" } });

    await t.test("overdue totals use the same authorized owner scope as the queue", async () => {
      assert.equal((await crm.stats(actor)).overdueFollowUps, 1);
    });
    const customerFollow = await db.followUp.create({ data: { customerId: customer.id, dueAt: yesterday, subject: "Customer-only follow-up" } });
    const customerTask = await db.task.create({ data: { customerId: customer.id, dueDate: yesterday, title: "Customer-only task" } });
    const invalidFollow = await db.followUp.create({ data: { leadId: foreignLead.id, customerId: customer.id, dueAt: yesterday, subject: "Inconsistent owner must be hidden" } });
    await t.test("customer-only work is visible, while inconsistent mixed ownership stays hidden", async () => {
      const queue = await crm.today(actor);
      assert.ok(queue.overdueFollowUps.some(f => f.id === customerFollow.id));
      assert.ok(queue.tasksDue.some(f => f.id === customerTask.id));
      assert.ok(!queue.overdueFollowUps.some(f => f.id === invalidFollow.id));
      assert.ok((await crm.upcomingFollowUps(actor)).every(f => f.id !== invalidFollow.id));
    });
    await db.quotation.create({ data: { quotationNumber: randomUUID(), customerId: customer.id, branchId: a.id } });
    await t.test("lead-only permission cannot read follow-up/task/quotation queues or their totals", async () => {
      const limited = { ...actor, permissions: ["lead.view"] };
      const queue = await crm.today(limited);
      assert.deepEqual(queue.overdueFollowUps, []);
      assert.deepEqual(queue.tasksDue, []);
      assert.deepEqual(queue.openQuotes, []);
      assert.equal((await crm.stats(limited)).overdueFollowUps, null);
    });
    await t.test("child route scope requires every linked owner to be authorized", async () => {
      const guard = new CrmScopeGuard(db as never);
      const req = { user: actor, method: "POST", route: { path: "/v1/crm/follow-ups/:id/status" }, params: { id: invalidFollow.id }, body: { status: "COMPLETED" } };
      await assert.rejects(guard.canActivate({ switchToHttp: () => ({ getRequest: () => req }) } as never), { status: 404 });
    });
    await t.test("generic follow-up create/edit/reparent/delete maintains both lead reminders", async () => {
      const one = await lead(), two = await lead();
      const f = await resources.create("follow-ups", actor, { leadId: one.id, subject: "First reminder", dueAt: first.toISOString() });
      await resources.create("follow-ups", actor, { leadId: one.id, subject: "Later reminder", dueAt: later.toISOString() });
      assert.equal((await db.lead.findUniqueOrThrow({ where: { id: one.id } })).nextFollowUpAt?.toISOString(), first.toISOString());
      await resources.update("follow-ups", String(f.id), actor, { leadId: two.id });
      assert.equal((await db.lead.findUniqueOrThrow({ where: { id: one.id } })).nextFollowUpAt?.toISOString(), later.toISOString());
      assert.equal((await db.lead.findUniqueOrThrow({ where: { id: two.id } })).nextFollowUpAt?.toISOString(), first.toISOString());
      await resources.remove("follow-ups", String(f.id), actor);
      assert.equal((await db.lead.findUniqueOrThrow({ where: { id: two.id } })).nextFollowUpAt, null);
    });
    await t.test("scheduling and completing work preserves confirmed sales status and earliest pending reminder", async () => {
      const l = await lead();
      await db.lead.update({ where: { id: l.id }, data: { status: "CONFIRMED" } });
      const f = await crm.addFollowUp(l.id, actor, { subject: "First", dueAt: first.toISOString() });
      await crm.addFollowUp(l.id, actor, { subject: "Later", dueAt: later.toISOString() });
      let state = await db.lead.findUniqueOrThrow({ where: { id: l.id } });
      assert.equal(state.status, "CONFIRMED");
      assert.equal(state.nextFollowUpAt?.toISOString(), first.toISOString());
      await crm.setFollowUpStatus(String(f.id), "COMPLETED", actor);
      state = await db.lead.findUniqueOrThrow({ where: { id: l.id } });
      assert.equal(state.nextFollowUpAt?.toISOString(), later.toISOString());
      await crm.rescheduleFollowUp(String(f.id), first.toISOString(), actor);
      assert.equal((await db.lead.findUniqueOrThrow({ where: { id: l.id } })).nextFollowUpAt?.toISOString(), first.toISOString());
    });
    await t.test("legacy assignment cannot select staff outside the lead branch", async () => {
      const l = await lead();
      await assert.rejects(crm.assign(l.id, actor, foreign.id, undefined, l.updatedAt.toISOString()), { status: 400 });
      assert.equal((await db.lead.findUniqueOrThrow({ where: { id: l.id } })).assignedUserId, null);
    });
    await t.test("lead.edit alone cannot bypass assignment or delete authority through batch actions", async () => {
      const l = await lead(), limited = { ...actor, permissions: ["lead.view", "lead.edit"] };
      for (const action of ["assign", "delete"]) await assert.rejects(crm.bulk(limited, [l.id], action, staff.id), { status: 403 });
      assert.ok(await db.lead.findUnique({ where: { id: l.id } }));
    });
    await t.test("audit failure rolls back batch changes", async () => {
      const l = await lead();
      const failing = new CrmService(db as never, seq, { log: async () => { throw Error("synthetic audit failure"); } } as never, {} as never, {} as never, {} as never, {} as never);
      await assert.rejects(failing.bulk(actor, [l.id], "archive"), /synthetic audit failure/);
      assert.equal((await db.lead.findUniqueOrThrow({ where: { id: l.id } })).archivedAt, null);
    });
    await t.test("generic bulk delete is all-or-nothing when a later record is unauthorized", async () => {
      const l = await lead();
      await assert.rejects(resources.bulk("leads", actor, [l.id, foreignLead.id], "delete"), { status: 404 });
      assert.ok(await db.lead.findUnique({ where: { id: l.id } }));
    });
    await t.test("unconfigured delivery never marks a quotation SENT", async () => {
      const q = await db.quotation.create({ data: { quotationNumber: randomUUID(), customerId: customer.id, branchId: a.id } });
      await assert.rejects(crm.sendQuotation(q.id, actor), { status: 409 });
      assert.equal((await db.quotation.findUniqueOrThrow({ where: { id: q.id } })).status, "DRAFT");
    });
    await t.test("lead/customer workspaces do not bypass child-module view permissions", async () => {
      const lw = await crm.workspace(localLead.id, { ...actor, permissions: ["lead.view"] });
      assert.deepEqual(lw.lead.followUps, []);
      assert.deepEqual(lw.receipts, []);
      const cw = await crm.customerWorkspace(customer.id, { ...actor, permissions: ["customer.view"] });
      assert.deepEqual(cw.customer.tasks, []);
      assert.deepEqual(cw.customer.followUps, []);
      assert.equal(cw.outstanding, null);
    });
    await t.test("merging leads cannot reparent customer history across branches", async () => {
      const keep = await lead(), drop = await lead(b.id);
      await assert.rejects(crm.mergeLeads(keep.id, drop.id, { ...actor, branchIds: [a.id, b.id] }), { status: 400 });
      assert.equal((await db.lead.findUniqueOrThrow({ where: { id: drop.id } })).archivedAt, null);
    });
    await t.test("audit insertion failure rolls back a follow-up and its lead reminder together", async () => {
      const l = await lead();
      const before = await db.followUp.count({ where: { leadId: l.id } });
      await assert.rejects(resources.create("follow-ups", { ...actor, id: "synthetic-missing-audit-user" }, { subject: "Must roll back", leadId: l.id, dueAt: first.toISOString() }));
      assert.equal(await db.followUp.count({ where: { leadId: l.id } }), before);
      assert.equal((await db.lead.findUniqueOrThrow({ where: { id: l.id } })).nextFollowUpAt, null);
    });
    await t.test("concurrent follow-up writers preserve the earliest committed reminder or return409", async () => {
      const l = await lead();
      const results = await Promise.allSettled([first, later].map(dueAt => resources.create("follow-ups", actor, { subject: "Concurrent reminder", leadId: l.id, dueAt: dueAt.toISOString() })));
      assert.ok(results.some(r => r.status === "fulfilled"));
      for (const r of results) if (r.status === "rejected") assert.equal(r.reason.status, 409, JSON.stringify({ name: r.reason.name, code: r.reason.code, sqlState: r.reason.meta?.code }));
      const pending = await db.followUp.findMany({ where: { leadId: l.id, status: "PENDING" }, orderBy: { dueAt: "asc" } });
      assert.equal(pending.length, results.filter(r => r.status === "fulfilled").length);
      assert.equal((await db.lead.findUniqueOrThrow({ where: { id: l.id } })).nextFollowUpAt?.toISOString(), pending[0].dueAt.toISOString());
    });
    await t.test("concurrent assignment rejects a stale writer, preserves agency and sends one transactional notification", async () => {
      const agency = await db.agent.create({ data: { name: "Synthetic preserved agency" } });
      const initial = await lead();
      const l = await db.lead.update({ where: { id: initial.id }, data: { assignedAgentId: agency.id } });
      const before = await db.notification.count({ where: { userId: staff.id, type: "LEAD" } });
      const results = await Promise.allSettled([1, 2].map(() => crm.assign(l.id, actor, staff.id, undefined, l.updatedAt.toISOString())));
      assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
      for (const r of results) if (r.status === "rejected") assert.equal(r.reason.status, 409, JSON.stringify({ name: r.reason.name, code: r.reason.code, sqlState: r.reason.meta?.code }));
      const saved = await db.lead.findUniqueOrThrow({ where: { id: l.id } });
      assert.equal(saved.assignedAgentId, agency.id);
      assert.equal(saved.assignedUserId, staff.id);
      assert.equal(await db.auditLog.count({ where: { entityId: l.id, action: "ASSIGN" } }), 1);
      assert.equal(await db.notification.count({ where: { userId: staff.id, type: "LEAD" } }), before + 1);
    });
    await t.test("merge audit failure restores linked work and both leads", async () => {
      const keep = await lead(), drop = await lead();
      const f = await db.followUp.create({ data: { leadId: drop.id, dueAt: first, subject: "Retained source work" } });
      const failing = new CrmService(db as never, seq, { log: async () => { throw Error("synthetic merge audit failure"); } } as never, {} as never, {} as never, {} as never, {} as never);
      await assert.rejects(failing.mergeLeads(keep.id, drop.id, actor), /synthetic merge audit failure/);
      assert.equal((await db.followUp.findUniqueOrThrow({ where: { id: f.id } })).leadId, drop.id);
      assert.equal((await db.lead.findUniqueOrThrow({ where: { id: drop.id } })).archivedAt, null);
    });
    await t.test("quotation sending cannot regress a converted quotation", async () => {
      const q = await db.quotation.create({ data: { quotationNumber: randomUUID(), customerId: customer.id, branchId: a.id, status: "CONVERTED" } });
      await assert.rejects(crm.sendQuotation(q.id, actor), { status: 409 });
      assert.equal((await db.quotation.findUniqueOrThrow({ where: { id: q.id } })).status, "CONVERTED");
    });
    assert.equal((await db.followUp.findUniqueOrThrow({ where: { id: localFollow.id } })).status, "PENDING");
  } finally { await db.$disconnect(); }
});
