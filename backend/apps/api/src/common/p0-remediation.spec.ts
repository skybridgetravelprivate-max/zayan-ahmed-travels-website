import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { AuthController } from "../auth/auth.controller";
import { StaffAccessService } from "../auth/staff-access.service";
import { ResourcesService } from "../resources/resources.service";
import { WorkflowsController } from "../workflows/workflows.controller";
import { UmrahOpsService } from "../umrah/umrah-ops.service";
import type { AuthUser } from "../auth/auth.types";

const user: AuthUser = { id: "staff", email: "test@example.test", username: "staff", fullName: "Staff", permissions: ["task.view", "task.edit", "followup.view", "ticket.view", "notification.view", "lead.edit"], roleNames: [], branchIds: ["a"], defaultBranchId: "a", isSuperAdmin: false };
const req = { user } as never;
const audit = { log: async () => {} };

test("generic task, follow-up, reissue and notification collections retain owner scope even with hostile filters", async () => {
  for (const [resource, model] of [["tasks", "task"], ["follow-ups", "followUp"], ["ticket-reissues", "ticketReissue"], ["notifications", "notification"]]) {
    const queries: Record<string, unknown>[] = [];
    const delegate = { findMany: async ({ where }: { where: Record<string, unknown> }) => { queries.push(where); return []; }, count: async () => 0 };
    const svc = new ResourcesService({ [model]: delegate } as never, {} as never, audit as never);
    await svc.list(resource, user, { userId: "other", OR: "anything", AND: "anything" });
    const where = queries[0];
    if (resource === "notifications") assert.equal(where.userId, user.id);
    else if (resource === "ticket-reissues") assert.deepEqual(where.originalTicket, { branchId: { in: ["a"] } });
    else {
      assert.equal((where.AND as unknown[]).length, 3);
      assert.match(JSON.stringify(where.AND), /"branchId":\{"in":\["a"\]\}/);
    }
  }
});

test("generic detail and edits reject foreign parent ownership, including notifications", async () => {
  const db = {
    task: { findUnique: async () => ({ id: "task", leadId: "foreign" }) },
    lead: { findUnique: async () => ({ branchId: "b" }) },
    ticketReissue: { findUnique: async () => ({ originalTicketId: "foreign" }) },
    ticketSale: { findUnique: async () => ({ branchId: "b" }) },
    notification: { findUnique: async () => ({ userId: "other" }) },
  };
  const svc = new ResourcesService(db as never, {} as never, audit as never);
  for (const resource of ["tasks", "ticket-reissues", "notifications"]) await assert.rejects(svc.get(resource, "id", user), { status: 404 });
  await assert.rejects(svc.update("tasks", "id", user, { title: "tampered" }), { status: 404 });
});

test("generic financial writers and lead assignment overposting are rejected before writes", async () => {
  const svc = new ResourcesService({ lead: { findUnique: async () => ({ id: "lead", branchId: "a" }) } } as never, {} as never, audit as never);
  const actor = { ...user, permissions: ["booking.create", "booking.edit", "ticket.create", "lead.edit"] };
  await assert.rejects(svc.create("tickets", actor, { net: 1, paidAmount: 1 }), { status: 403 });
  await assert.rejects(svc.create("umrah-bookings", actor, { paid: 1 }), { status: 403 });
  await assert.rejects(svc.update("umrah-bookings", "id", actor, { status: "COMPLETED", paid: 1 }), { status: 403 });
  await assert.rejects(svc.update("leads", "lead", actor, { assignedUserId: "other" }), /Unsupported field/);
  await assert.rejects(svc.update("leads", "lead", actor, { branchId: "b" }), { status: 403 });
});

test("permitted generic profile edits still persist and audit atomically", async () => {
  let updated = false, logged = false;
  const tx = {
    lead: { findUnique: async () => ({ id: "lead", branchId: "a" }), update: async ({ data }: { data: object }) => { assert.deepEqual(data, { fullName: "Updated" }); updated = true; return { id: "lead", ...data }; } },
    auditLog: { create: async () => { logged = true; } },
  };
  const db = { $transaction: async (run: (db: unknown) => Promise<unknown>, options: object) => { assert.deepEqual(options, { isolationLevel: "Serializable" }); return run(tx); } };
  const svc = new ResourcesService(db as never, {} as never, audit as never);
  await svc.update("leads", "lead", user, { fullName: "Updated" });
  assert.ok(updated && logged);
});

function refreshHarness() {
  const raw = "a".repeat(96);
  const session = { id: "session", userId: user.id, refreshTokenHash: createHash("sha256").update(raw).digest("hex"), expiresAt: new Date(Date.now() + 3600000), revokedAt: null as Date | null };
  const db = {
    session: {
      findUnique: async () => ({ ...session }),
      updateMany: async ({ where, data }: { where: { refreshTokenHash?: string }; data: { refreshTokenHash?: string; revokedAt?: Date } }) => {
        if (session.revokedAt || where.refreshTokenHash && where.refreshTokenHash !== session.refreshTokenHash) return { count: 0 };
        Object.assign(session, data); return { count: 1 };
      },
    },
    user: { findUnique: async () => ({ status: "ACTIVE" }) },
  };
  const cookies = new Map<string, string>();
  const response = { cookie: (name: string, value: string) => cookies.set(name, value), clearCookie: (name: string) => cookies.delete(name) };
  const controller = new AuthController(db as never, { signAsync: async () => "signed-access" } as never, {} as never);
  return { raw, session, cookies, response, controller };
}

test("refresh rotates the opaque secret, keeps absolute expiry and revokes on replay", async () => {
  const h = refreshHarness();
  const request = { cookies: { refresh_token: "session." + h.raw } } as never;
  await h.controller.refresh(request, h.response as never);
  const next = h.cookies.get("refresh_token")!;
  assert.notEqual(next, "session." + h.raw);
  assert.equal(h.session.refreshTokenHash, createHash("sha256").update(next.split(".")[1]).digest("hex"));
  await assert.rejects(h.controller.refresh(request, h.response as never), { status: 401 });
  assert.ok(h.session.revokedAt);
  assert.equal(h.cookies.size, 0);
});

test("simultaneous refresh cannot keep two usable refresh secrets", async () => {
  const h = refreshHarness();
  const request = { cookies: { refresh_token: "session." + h.raw } } as never;
  const results = await Promise.allSettled([h.controller.refresh(request, h.response as never), h.controller.refresh(request, h.response as never)]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.ok(h.session.revokedAt);
});

test("posted Umrah money and payments reject direct edits while notes preserve existing totals", async () => {
  const existing = { id: "booking", branchId: "a", customerId: "customer", cost: new Prisma.Decimal(50), sellingPrice: new Prisma.Decimal(100), discount: new Prisma.Decimal(0), tax: new Prisma.Decimal(0), commission: new Prisma.Decimal(0), paid: new Prisma.Decimal(20), net: new Prisma.Decimal(99), profit: new Prisma.Decimal(49), balance: new Prisma.Decimal(79), iataLocked: false };
  let writes = 0;
  const tx = {
    umrahBooking: { findUniqueOrThrow: async () => existing, findUnique: async () => existing, update: async ({ data }: { data: { paid: Prisma.Decimal; sellingPrice: Prisma.Decimal; net: Prisma.Decimal; balance: Prisma.Decimal; profit: Prisma.Decimal } }) => { assert.equal(data.paid.toNumber(), 20); assert.equal(data.sellingPrice.toNumber(), 100); assert.equal(data.net.toNumber(), 99); assert.equal(data.balance.toNumber(), 79); assert.equal(data.profit.toNumber(), 49); writes++; return existing; } },
    customer: { findUnique: async () => ({ branchId: "a" }) },
    journalEntry: { findFirst: async () => ({ id: "posted" }) },
  };
  const db = { $transaction: async (run: (tx: unknown) => Promise<unknown>) => run(tx) };
  const service = new UmrahOpsService(db as never, {} as never, audit as never, {} as never);
  const actor = { ...user, permissions: ["umrah.edit"] };
  await assert.rejects(service.save(actor, { id: "booking", sellingPrice: 101 }), { status: 403 });
  await assert.rejects(service.save(actor, { id: "booking", paid: 21 }), { status: 403 });
  await service.save(actor, { id: "booking", notes: "safe edit" });
  assert.equal(writes, 1);
});

function workflowHarness(failCost = false) {
  let state = { bookings: [] as Record<string, unknown>[], tickets: [] as Record<string, unknown>[], reissues: [] as Record<string, unknown>[], journals: [] as unknown[], quoteStatus: "ACCEPTED", ticketStatus: "ISSUED", reserved: 0 };
  let tail = Promise.resolve();
  let active: typeof state;
  const db = { $transaction: async (run: (tx: unknown) => Promise<unknown>) => {
    const prior = tail; let release!: () => void; tail = new Promise<void>(r => { release = r; }); await prior;
    active = JSON.parse(JSON.stringify(state)) as typeof state;
    let locked = false;
    const tx = {
      $queryRaw: async (parts: TemplateStringsArray) => { assert.match(parts.join("?"), /FOR UPDATE/); locked = true; return []; },
      quotation: { findUnique: async () => { assert.ok(locked); return { id: "quote", branchId: "a", customerId: "customer", currency: "PKR", status: active.quoteStatus, net: 100, costTotal: 50, sellingTotal: 100, discount: 0, tax: 0 }; }, update: async () => { active.quoteStatus = "CONVERTED"; } },
      customer: { findUnique: async () => ({ branchId: "a" }) },
      umrahBooking: { findFirst: async () => active.bookings[0], create: async ({ data }: { data: object }) => { const b = { id: "booking", ...data }; active.bookings.push(b); return b; } },
      umrahGroup: { findUnique: async () => { assert.ok(locked); return { branchId: "a", reservedSeats: active.reserved, totalSeats: 5 }; }, update: async ({ data }: { data: { reservedSeats: number } }) => { active.reserved = data.reservedSeats; return data; } },
      ticketSale: {
        findUnique: async () => { assert.ok(locked); return { id: "ticket", branchId: "a", status: active.ticketStatus, fare: 100, net: 100, cost: 50, profit: 50, tax: 0, paidAmount: 100, paymentStatus: "PAID", currency: "PKR" }; },
        create: async ({ data }: { data: object }) => { const t = { id: "new-ticket", ...data }; active.tickets.push(t); return t; },
        update: async () => { active.ticketStatus = "REISSUED"; },
      },
      ticketReissue: { create: async ({ data }: { data: object }) => { const r = { id: "reissue", ...data }; active.reissues.push(r); return r; } },
    };
    try { const result = await run(tx); state = active; return result; } finally { release(); }
  } };
  const accounting = {
    accountByCode: async (_code: string, tx: unknown) => { assert.ok(tx); return { id: _code }; },
    postSale: async ({ db: tx }: { db: unknown }) => { assert.ok(tx); active.journals.push("sale"); },
    postCost: async ({ db: tx }: { db: unknown }) => { assert.ok(tx); if (failCost) throw Error("cost failure"); active.journals.push("cost"); },
    postJournal: async ({ db: tx, kind, module }: { db: unknown; kind: string; module: string }) => { assert.ok(tx); assert.equal(kind, "REISSUE"); assert.equal(module, "ticket"); if (failCost) throw Error("journal failure"); active.journals.push("reissue"); return { id: "journal" }; },
  };
  const seq = { next: async (_key: string, _prefix: string, tx: unknown) => { assert.ok(tx); return "number"; } };
  const ctrl = new WorkflowsController(db as never, seq as never, audit as never, accounting as never, {} as never);
  return { ctrl, state: () => state };
}

test("concurrent quotation conversion returns one booking and one sale/cost pair", async () => {
  const h = workflowHarness();
  const results = await Promise.all([h.ctrl.convertQuote("quote", req), h.ctrl.convertQuote("quote", req)]);
  assert.equal(results[0].id, results[1].id);
  assert.equal(h.state().bookings.length, 1);
  assert.deepEqual(h.state().journals, ["sale", "cost"]);
});

test("conversion failure rolls back booking, status and journals", async () => {
  const h = workflowHarness(true);
  await assert.rejects(h.ctrl.convertQuote("quote", req), /cost failure/);
  assert.equal(h.state().bookings.length, 0);
  assert.equal(h.state().quoteStatus, "ACCEPTED");
  assert.equal(h.state().journals.length, 0);
});

test("reissue failure rolls back the new ticket, and repeated successful requests cannot duplicate it", async () => {
  const failed = workflowHarness(true);
  await assert.rejects(failed.ctrl.reissue("ticket", { agencyFee: 10 }, req), /journal failure/);
  assert.equal(failed.state().tickets.length, 0);
  const h = workflowHarness();
  await h.ctrl.reissue("ticket", { agencyFee: 10 }, req);
  await assert.rejects(h.ctrl.reissue("ticket", { agencyFee: 10 }, req), { status: 409 });
  assert.equal(h.state().tickets.length, 1);
  assert.equal(h.state().reissues.length, 1);
  assert.equal(h.state().journals.length, 1);
  await assert.rejects(workflowHarness().ctrl.reissue("ticket", { agencyFee: -1 }, req), { status: 400 });
});

test("seat allocations serialize capacity checks and reject negative, fractional and zero inputs", async () => {
  const h = workflowHarness();
  const result = await Promise.allSettled([h.ctrl.allocateSeats("group", { seats: 3 }, req), h.ctrl.allocateSeats("group", { seats: 3 }, req)]);
  assert.equal(result.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(h.state().reserved, 3);
  for (const seats of [-1, 0, 0.5, NaN]) await assert.rejects(h.ctrl.allocateSeats("group", { seats }, req), { status: 400 });
});

test("legacy staff access replacements preserve final administrator and validate references before deletion", async () => {
  let deleted = false;
  const before = { id: "last-admin", status: "ACTIVE", deletedAt: null, defaultBranchId: "a", updatedAt: new Date(), roles: [{ roleId: "super", role: { name: "SUPER_ADMIN" } }], branches: [{ branchId: "a" }] };
  const tx = { user: { findUnique: async () => before, count: async () => 0 }, role: { findMany: async () => [] }, branch: { count: async () => 1 }, userRole: { deleteMany: async () => { deleted = true; } } };
  const service = new StaffAccessService({ $transaction: async (run: (db: unknown) => Promise<unknown>, options: object) => { assert.deepEqual(options, { isolationLevel: "Serializable" }); return run(tx); } } as never);
  await assert.rejects(service.save({ ...user, isSuperAdmin: true }, "last-admin", { roleIds: [] }, true), /At least one active administrator/);
  assert.equal(deleted, false);
  await assert.rejects(service.save({ ...user, isSuperAdmin: true }, "last-admin", { roleIds: ["missing"] }, true), /unavailable/);
  assert.equal(deleted, false);
});

test("role-permission replacement commits audit and revocation together, rolling back on audit failure", async () => {
  for (const fail of [false, true]) {
    let state = { permissions: ["old"], revoked: false, audited: false };
    const db = { $transaction: async (run: (tx: unknown) => Promise<unknown>, options: object) => {
      assert.deepEqual(options, { isolationLevel: "Serializable" });
      const draft = structuredClone(state);
      const tx = {
        role: { findUnique: async () => ({ id: "role" }) },
        permission: { count: async () => 1 },
        rolePermission: { deleteMany: async () => { draft.permissions = []; }, createMany: async () => { draft.permissions.push("new"); } },
        userRole: { findMany: async () => [{ userId: "staff" }] },
        session: { updateMany: async () => { draft.revoked = true; } },
        auditLog: { create: async () => { if (fail) throw Error("audit failure"); draft.audited = true; } },
      };
      const result = await run(tx);
      state = draft;
      return result;
    } };
    const service = new StaffAccessService(db as never);
    if (fail) {
      await assert.rejects(service.setPermissions({ ...user, isSuperAdmin: true }, "role", ["new"]), /audit failure/);
      assert.deepEqual(state, { permissions: ["old"], revoked: false, audited: false });
    } else {
      await service.setPermissions({ ...user, isSuperAdmin: true }, "role", ["new"]);
      assert.deepEqual(state, { permissions: ["new"], revoked: true, audited: true });
    }
  }
});

