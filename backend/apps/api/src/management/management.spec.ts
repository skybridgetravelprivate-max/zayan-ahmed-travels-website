import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { MANAGEMENT, fieldsFor, modelFor, moduleContract } from "./management.catalog";
import { ManagementService, parseFields } from "./management.service";
import { ManagementOriginGuard } from "./management.guard";
import type { AuthUser } from "../auth/auth.types";
import type { PrismaService } from "../common/prisma.service";
import type { SequenceService } from "../common/sequence.service";

const user: AuthUser = { id: "staff-a", email: "synthetic@example.invalid", username: "staff", fullName: "Synthetic", roleNames: [], permissions: ["lead.view", "lead.edit", "lead.create", "lead.assign", "task.view", "task.edit"], branchIds: ["a"], defaultBranchId: "a", isSuperAdmin: false };
const admin = { ...user, isSuperAdmin: true };
const version = "2026-10-19T00:00:00.000Z";
const service = (db = {}) => new ManagementService(db as PrismaService, {} as SequenceService);

test("catalog is an explicit scalar allowlist matching the generated schema", () => {
  for (const [key, spec] of Object.entries(MANAGEMENT)) {
    const model = modelFor(key)!;
    assert.ok(model, key);
    for (const field of [...spec.fields.split(" "), ...(spec.write?.split(" ") ?? [])]) {
      assert.ok(model.fields.some(f => f.name === field && f.kind !== "object" && !f.isList), `${key}.${field}`);
    }
    assert.ok(!fieldsFor(key).some(f => /password|token|secret|rawData|storageKey/i.test(f.name)), key);
  }
});
test("permissions and administrator-only modules are enforced in the catalog and endpoints", async () => {
  const keys = service().catalog(user).map(m => m.key);
  assert.deepEqual(keys.sort(), ["leads", "tasks"]);
  assert.equal(moduleContract(user, "leads").canEdit, true);
  assert.equal(moduleContract({ ...user, permissions: ["lead.view"] }, "leads").canEdit, false);
  await assert.rejects(service().list(user, "users", {}), ForbiddenException);
  await assert.rejects(service().save(user, "journals", null, { data: {} }), ForbiddenException);
  await assert.rejects(service().list(admin, "__proto__", {}), ForbiddenException);
});
test("form validation rejects mass assignment, nested writes, malformed dates and counts", () => {
  const fields = fieldsFor("leads", true);
  for (const data of [{ assignedUserId: "outsider" }, { status: "CONFIRMED" }, { passwordHash: "x" }, { fullName: { set: "x" } }, { adults: -1 }, { adults: 1.5 }, { adults: "Infinity" }, { travelDate: "2026-02-30" }, { priority: "INVALID" }, { email: "invalid" }]) {
    assert.throws(() => parseFields(fields, data, false));
  }
  assert.throws(() => parseFields(fields, { fullName: "Only name" }, true));
  assert.deepEqual(parseFields(fields, { fullName: "2026-10-19 inquiry", mobile: "+000", adults: "2", travelDate: "2026-10-19T10:00" }, false), { fullName: "2026-10-19 inquiry", mobile: "+000", adults: 2, travelDate: new Date("2026-10-19T10:00:00Z") });
});
test("branch scope covers all linked task owners and personal notifications", () => {
  const scope = service().scope(user, "tasks") as { AND: unknown[] };
  assert.equal(scope.AND.length, 3);
  assert.match(JSON.stringify(scope), /leadId.*customerId.*assignedUserId/);
  assert.deepEqual(service().scope(user, "leads"), { branchId: { in: ["a"] } });
  assert.deepEqual(service().scope(user, "notifications"), { userId: "staff-a" });
});
test("list selects only public fields, retains branch scope and bounds pagination", async () => {
  let args: Record<string, unknown> | undefined;
  const db = { lead: { findMany: async (input: Record<string, unknown>) => { args = input; return [{ id: "lead-a", fullName: "Synthetic", mobile: "+000", passwordHash: "secret", updatedAt: new Date(version) }]; }, count: async () => 1 } };
  const result = await service(db).list(user, "leads", { page: "2", q: "Synthetic" });
  assert.equal(args?.skip, 20);
  assert.match(JSON.stringify(args?.where), /branchId.*a/);
  assert.equal((args?.select as Record<string, unknown>).passwordHash, undefined);
  assert.equal(result.data[0].passwordHash, undefined);
  assert.equal(result.data[0].version, version);
  await assert.rejects(service(db).list(user, "leads", { page: "1.5" }));
});
test("foreign or missing detail fails closed and no privileged relation payload escapes", async () => {
  const db = { lead: { findMany: async () => [] } };
  await assert.rejects(service(db).detail(user, "leads", "foreign"), NotFoundException);
});
test("stale edit is rejected inside the transaction before any mutation", async () => {
  let writes = 0;
  const tx = { lead: { findMany: async () => [{ id: "lead-a", branchId: "a", updatedAt: new Date(version) }], update: async () => { writes++; } } };
  const db = { $transaction: async (run: (tx: unknown) => unknown) => run(tx) };
  await assert.rejects(service(db).save(user, "leads", "lead-a", { data: { fullName: "Changed" }, version: "stale" }), /Record changed/);
  assert.equal(writes, 0);
});
test("assignment rejects inactive or foreign-branch staff before updating a lead", async () => {
  let writes = 0;
  const lead = { id: "lead-a", branchId: "a", updatedAt: new Date(version) };
  const tx = { lead: { findMany: async () => [lead], update: async () => { writes++; } }, user: { findUnique: async () => ({ id: "staff-b", status: "ACTIVE", deletedAt: null, defaultBranchId: "b", branches: [] }) } };
  const db = { $transaction: async (run: (tx: unknown) => unknown) => run(tx) };
  await assert.rejects(service(db).assign(user, "lead-a", { assignedUserId: "staff-b", version }), /record branch/);
  assert.equal(writes, 0);
  await assert.rejects(service(db).assign({ ...user, permissions: ["lead.view"] }, "lead-a", { assignedUserId: "staff-b", version }), ForbiddenException);
});
test("assignment changes only assigned staff and writes an audit in the same transaction", async () => {
  let data: unknown;
  let audit: unknown;
  const lead = { id: "lead-a", branchId: "a", assignedAgentId: "agent-preserved", updatedAt: new Date(version) };
  const tx = { lead: { findMany: async () => [lead], update: async (args: { data: unknown }) => { data = args.data; return { ...lead, assignedUserId: "staff-next" }; } }, user: { findUnique: async () => ({ id: "staff-next", status: "ACTIVE", deletedAt: null, defaultBranchId: "a", branches: [] }) }, auditLog: { create: async (args: unknown) => { audit = args; } } };
  const db = { $transaction: async (run: (tx: unknown) => unknown, options: { isolationLevel: string }) => { assert.equal(options.isolationLevel, "Serializable"); return run(tx); } };
  await service(db).assign(user, "lead-a", { assignedUserId: "staff-next", version });
  assert.deepEqual(data, { assignedUserId: "staff-next" });
  assert.match(JSON.stringify(audit), /ASSIGN/);
});
test("status requires a reason and rejects stale versions without writing", async () => {
  await assert.rejects(service().leadStatus(user, "lead-a", { status: "LOST", version }), /reason/);
  await assert.rejects(service().leadStatus(user, "lead-a", { status: "INVALID", version }), /Invalid/);
  const db = { $transaction: async (run: (tx: unknown) => unknown) => run({ lead: { findMany: async () => [{ id: "lead-a", updatedAt: new Date(version) }] } }) };
  await assert.rejects(service(db).leadStatus(user, "lead-a", { status: "CONTACTED", version: "stale" }), /Record changed/);
});
test("browser mutation guard rejects missing/foreign Origin and disables caching", () => {
  const previous = process.env.APP_URL;
  process.env.APP_URL = "https://example.invalid";
  try {
    const context = (origin?: string) => ({ switchToHttp: () => ({ getRequest: () => ({ method: "PATCH", headers: { origin } }), getResponse: () => ({ setHeader: (key: string, value: string) => { assert.equal(key, "Cache-Control"); assert.equal(value, "private, no-store"); } }) }) });
    const guard = new ManagementOriginGuard();
    assert.throws(() => guard.canActivate(context() as never), ForbiddenException);
    assert.throws(() => guard.canActivate(context("https://other.invalid") as never), ForbiddenException);
    assert.equal(guard.canActivate(context("https://example.invalid") as never), true);
  } finally { if (previous === undefined) delete process.env.APP_URL; else process.env.APP_URL = previous; }
});

test("staff access denies scoped operators and prevents administrator self-lockout", async () => {
  await assert.rejects(service().staffAccess(user, "staff-a"), ForbiddenException);
  await assert.rejects(service().createStaff(user, {}), ForbiddenException);
  let writes = 0;
  const tx = { user: { findUnique: async () => ({ id: admin.id, updatedAt: new Date(version), roles: [{ role: { name: "SUPER_ADMIN" } }], branches: [] }), update: async () => { writes++; } }, role: { findMany: async () => [] }, branch: { count: async () => 0 } };
  const db = { $transaction: async (run: (tx: unknown) => unknown) => run(tx) };
  await assert.rejects(service(db).saveStaffAccess(admin, admin.id, { roleIds: [], branchIds: [], defaultBranchId: null, status: "INACTIVE", version }), /own active administrator/);
  assert.equal(writes, 0);
});
test("staff access validates references, changes scope and revokes sessions atomically", async () => {
  const calls: string[] = [];
  const tx = {
    user: { findUnique: async () => ({ id: "other", updatedAt: new Date(version), roles: [], branches: [], deletedAt: null }), update: async () => { calls.push("user"); } },
    role: { findMany: async () => [{ id: "role-employee", name: "EMPLOYEE" }] }, branch: { count: async () => 1 },
    userRole: { deleteMany: async () => { calls.push("old-roles"); }, createMany: async () => { calls.push("new-roles"); } },
    userBranch: { deleteMany: async () => { calls.push("old-branches"); }, createMany: async () => { calls.push("new-branches"); } },
    session: { updateMany: async (args: { where: { userId: string }; data: { revokedAt: unknown } }) => { assert.equal(args.where.userId, "other"); assert.ok(args.data.revokedAt instanceof Date); calls.push("revoke"); } },
    auditLog: { create: async () => { calls.push("audit"); } },
  };
  const db = { $transaction: async (run: (tx: unknown) => unknown, opts: { isolationLevel: string }) => { assert.equal(opts.isolationLevel, "Serializable"); return run(tx); } };
  const body = { roleIds: ["role-employee"], branchIds: ["branch-a"], defaultBranchId: "branch-a", status: "ACTIVE", version };
  await service(db).saveStaffAccess(admin, "other", body);
  assert.deepEqual(calls, ["old-roles", "new-roles", "old-branches", "new-branches", "user", "revoke", "audit"]);
  await assert.rejects(service(db).saveStaffAccess(admin, "other", { ...body, defaultBranchId: "foreign" }), /Default branch/);
  await assert.rejects(service(db).saveStaffAccess(admin, "other", { ...body, roleIds: ["duplicate", "duplicate"] }), /Invalid access/);
});
test("staff creation starts inactive, hashes passwords, and excludes secrets from audit and response", async () => {
  let created: Record<string, unknown> = {};
  let audit: unknown;
  const tx = { user: { create: async ({ data }: { data: Record<string, unknown> }) => { created = data; return { id: "new-staff", ...data }; } }, auditLog: { create: async (args: unknown) => { audit = args; } } };
  const db = { $transaction: async (run: (tx: unknown) => unknown) => run(tx) };
  const result = await service(db).createStaff(admin, { fullName: "Synthetic", username: "synthetic", email: "SYNTHETIC@example.invalid", password: "synthetic-only-password" });
  assert.equal(created.status, "INACTIVE");
  assert.equal(created.email, "synthetic@example.invalid");
  assert.match(String(created.passwordHash), /^\$2/);
  assert.deepEqual(result, { id: "new-staff", status: "INACTIVE" });
  assert.doesNotMatch(JSON.stringify(audit), /password|synthetic-only-password|\$2/);
  await assert.rejects(service(db).createStaff(admin, { fullName: "Synthetic", username: "synthetic", email: "synthetic@example.invalid", password: "synthetic-only-password", status: "ACTIVE" }), /Invalid staff/);
});
