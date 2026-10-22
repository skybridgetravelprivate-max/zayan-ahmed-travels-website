import assert from "node:assert/strict";
import { test } from "node:test";
import type { ExecutionContext } from "@nestjs/common";
import { ResourcesService } from "../resources/resources.service";
import { CrmScopeGuard } from "../crm/crm-scope.guard";
import { AuthController } from "../auth/auth.controller";
import { AccountingService } from "../finance/accounting.service";
import { FinanceController } from "../finance/finance.controller";
import { WebsiteCustomerLinkController } from "../website/website-customer-link.controller";
import { DashboardController } from "../dashboard/dashboard.controller";
import { GlobalFinanceGuard } from "../auth/global-finance.guard";
import type { AuthUser } from "../auth/auth.types";

const user: AuthUser = { id: "staff", email: "staff@example.test", username: "staff", fullName: "Staff", permissions: [], roleNames: [], branchIds: ["branch-a"], defaultBranchId: null, isSuperAdmin: false };
const admin = { ...user, isSuperAdmin: true };
const request = (u = user) => ({ user: u }) as never;

test("audit records and finance records cannot be changed through generic CRUD", async () => {
  const service = new ResourcesService({} as never, {} as never, {} as never);
  for (const resource of ["audit-logs", "journals", "receipts", "payments", "expenses"]) {
    await assert.rejects(service.create(resource, admin, {}), { status: 403 });
    await assert.rejects(service.update(resource, "id", admin, {}), { status: 403 });
    await assert.rejects(service.remove(resource, "id", admin), { status: 403 });
  }
  await assert.rejects(service.update("users", "super-admin", { ...user, permissions: ["user.manage"] }, { password: "fixture-password" }), { status: 403 });
  await assert.rejects(service.update("roles", "id", { ...user, permissions: ["role.manage"] }, { name: "SUPER_ADMIN" }), { status: 403 });
});

test("lead bulk archive requires permission and applies branch scope", async () => {
  let where: unknown;
  const service = new ResourcesService({ lead: { updateMany: async (arg: { where: unknown }) => { where = arg.where; return { count: 1 }; } } } as never, {} as never, { log: async () => {} } as never);
  await assert.rejects(service.bulk("leads", user, ["lead-a"], "archive"), { status: 403 });
  assert.equal(where, undefined);
  assert.deepEqual(await service.bulk("leads", { ...user, permissions: ["lead.edit"] }, ["lead-a", "lead-b"], "archive"), { ok: true, count: 1 });
  assert.deepEqual(where, { id: { in: ["lead-a", "lead-b"] }, branchId: { in: ["branch-a"] } });
});

test("nested staff secrets are redacted while date values remain intact", async () => {
  const date = new Date();
  const service = new ResourcesService({ lead: { findUnique: async () => ({ id: "lead", branchId: "branch-a", createdAt: date, assignedUser: { fullName: "Staff", passwordHash: "private", session: { refreshTokenHash: "private" } } }) } } as never, {} as never, {} as never);
  const row = await service.get("leads", "lead", { ...user, permissions: ["lead.view"] });
  assert.ok(!JSON.stringify(row).includes("private"));
  assert.equal((row as { createdAt: Date }).createdAt, date);
});

test("CRM record guard rejects another branch and checks both sides of a merge", async () => {
  const reads: unknown[] = [];
  const guard = new CrmScopeGuard({ lead: { findFirst: async (arg: { where: { id: string } }) => { reads.push(arg.where); return arg.where.id === "allowed" ? { id: "allowed" } : null; } } } as never);
  const context = (id: string, body = {}) => ({ switchToHttp: () => ({ getRequest: () => ({ user, route: { path: "/api/v1/crm/leads/:id/merge" }, params: { id }, body, method: "POST" }) }) }) as ExecutionContext;
  await assert.rejects(guard.canActivate(context("foreign")), { status: 404 });
  await assert.rejects(guard.canActivate(context("allowed", { otherId: "foreign" })), { status: 404 });
  assert.deepEqual(reads[0], { id: "foreign", branchId: { in: ["branch-a"] } });
});

test("disabled staff cannot be changed to a temporary lock through failed login", async () => {
  const controller = new AuthController({ user: { findFirst: async () => ({ id: "disabled", status: "INACTIVE", failedLogins: 4 }) } } as never, {} as never, {} as never);
  await assert.rejects(controller.login({ identifier: "disabled", password: "not-real-password" }, {} as never, {} as never), { status: 401 });
});

test("password reset claims token atomically and revokes old sessions", async () => {
  let revoked = false;
  let changed = false;
  const tx = { passwordResetToken: { updateMany: async () => ({ count: 1 }) }, user: { findUnique: async () => ({ id: "staff", status: "ACTIVE" }), update: async () => { changed = true; } }, session: { updateMany: async () => { revoked = true; } } };
  const controller = new AuthController({ passwordResetToken: { findFirst: async () => ({ id: "token", email: user.email }) }, $transaction: async (fn: (db: typeof tx) => unknown) => fn(tx) } as never, {} as never, {} as never);
  assert.deepEqual(await controller.reset({ token: "fixture-token", password: "fixture-password-123" }), { ok: true });
  assert.equal(changed, true); assert.equal(revoked, true);
  tx.passwordResetToken.updateMany = async () => ({ count: 0 });
  changed = false;
  await assert.rejects(controller.reset({ token: "fixture-token", password: "fixture-password-123" }), { status: 400 });
  assert.equal(changed, false);
});

test("website linking requires super-admin and explicit ownership confirmation", async () => {
  const controller = new WebsiteCustomerLinkController({} as never);
  await assert.rejects(controller.verify({ ownershipVerified: true, websiteCustomerId: "web", crmCustomerId: "crm" }, request()), { status: 403 });
  await assert.rejects(controller.verify({ websiteCustomerId: "web", crmCustomerId: "crm" }, request(admin)), { status: 400 });
});

test("verified website link checks normalized email and writes the link and audit in one transaction", async () => {
  let websiteUpdate: unknown;
  let auditRecord: unknown;
  const tx = {
    websiteCustomer: {
      findUnique: async () => ({ id: "web", email: "owner@example.test" }),
      update: async (args: unknown) => { websiteUpdate = args; },
    },
    customer: { findUnique: async () => ({ id: "crm", email: " OWNER@example.test ", deletedAt: null }) },
    auditLog: { create: async (args: unknown) => { auditRecord = args; } },
  };
  const controller = new WebsiteCustomerLinkController({ $transaction: async (run: (db: typeof tx) => unknown) => run(tx) } as never);
  assert.deepEqual(
    await controller.verify({ ownershipVerified: true, websiteCustomerId: "web", crmCustomerId: "crm" }, request(admin)),
    { ok: true },
  );
  assert.deepEqual(websiteUpdate, { where: { id: "web" }, data: { crmCustomerId: "crm" } });
  assert.deepEqual(auditRecord, {
    data: {
      userId: admin.id,
      action: "VERIFY_WEBSITE_CUSTOMER_LINK",
      entity: "WebsiteCustomer",
      entityId: "web",
      after: { crmCustomerId: "crm" },
    },
  });
});

test("global financial dashboard does not expose company data to scoped staff", async () => {
  const controller = new DashboardController({} as never);
  await assert.rejects(controller.summary({}, request()), { status: 403 });
  await assert.rejects(controller.charts({}, request()), { status: 403 });
});

test("receipt rejects a customer mismatch before any financial posting", async () => {
  let posted = false;
  const tx = { umrahBooking: { findUnique: async () => ({ customerId: "owner", branchId: "branch-a" }) } };
  const controller = new FinanceController({ $transaction: async (fn: (db: typeof tx) => unknown) => fn(tx) } as never, {} as never, {} as never, { postReceipt: async () => { posted = true; } } as never);
  await assert.rejects(controller.createReceipt({ bookingId: "booking", customerId: "other", amount: 10, method: "CASH" }, request(admin)), { status: 400 });
  assert.equal(posted, false);
});

test("receipt journal, balance, receipt and audit share the serializable transaction", async () => {
  const writes: string[] = [];
  let isolationLevel: string | undefined;
  const tx = {
    umrahBooking: {
      findUnique: async () => ({ id: "booking", customerId: "owner", branchId: "branch-a", paid: 5, net: 100, status: "DRAFT" }),
      update: async ({ data }: { data: { paid: { toNumber(): number } } }) => { writes.push("booking"); assert.equal(data.paid.toNumber(), 15); },
    },
    receipt: { create: async ({ data }: { data: { journalId: string } }) => { writes.push("receipt"); assert.equal(data.journalId, "journal"); return { id: "receipt" }; } },
  };
  const controller = new FinanceController(
    { $transaction: async (run: (db: typeof tx) => unknown, options: { isolationLevel: string }) => { isolationLevel = options.isolationLevel; return run(tx); } } as never,
    { next: async (_key: string, _prefix: string, db: unknown) => { assert.equal(db, tx); writes.push("sequence"); return "REC1"; } } as never,
    { log: async (input: { db: unknown }) => { assert.equal(input.db, tx); writes.push("audit"); } } as never,
    { postReceipt: async (input: { db: unknown }) => { assert.equal(input.db, tx); writes.push("journal"); return { id: "journal" }; } } as never,
  );
  const result = await controller.createReceipt({ bookingId: "booking", customerId: "owner", amount: 10, method: "CASH" }, request(admin));
  assert.deepEqual(result, { id: "receipt" });
  assert.equal(isolationLevel, "Serializable");
  assert.deepEqual(writes, ["journal", "sequence", "receipt", "booking", "audit"]);
});

test("receipt posting requests serializable isolation and propagates transaction conflicts", async () => {
  let isolationLevel: string | undefined;
  const tx = {
    umrahBooking: {
      findUnique: async () => ({ id: "booking", customerId: "owner", branchId: "branch-a", paid: 0, net: 100, status: "DRAFT" }),
      update: async () => ({}),
    },
    receipt: { create: async () => ({ id: "receipt" }) },
  };
  const conflict = new Error("serialization conflict");
  const prisma = {
    $transaction: async (_run: (db: typeof tx) => unknown, options: { isolationLevel: string }) => {
      isolationLevel = options.isolationLevel;
      throw conflict;
    },
  };
  let posted = false;
  const controller = new FinanceController(
    prisma as never,
    {} as never,
    {} as never,
    { postReceipt: async () => { posted = true; return { id: "journal" }; } } as never,
  );
  await assert.rejects(
    controller.createReceipt({ bookingId: "booking", customerId: "owner", amount: 10, method: "CASH" }, request(admin)),
    error => error === conflict,
  );
  assert.equal(isolationLevel, "Serializable");
  assert.equal(posted, false);
});

test("journal reversal claims original once and posts in the same transaction", async () => {
  let claimed = false;
  const tx = { journalEntry: { findUnique: async () => ({ id: "journal", status: "POSTED", entryNumber: "J1", kind: "MANUAL", lines: [{ accountId: "a", debit: 10, credit: 0 }, { accountId: "b", debit: 0, credit: 10 }] }), updateMany: async () => ({ count: claimed ? 0 : (claimed = true, 1) }), update: async () => ({}) } };
  const service = new AccountingService({ $transaction: async (fn: (db: typeof tx) => unknown) => fn(tx) } as never, {} as never, {} as never);
  service.postJournal = async (input) => { assert.equal(input.db, tx); assert.equal(input.lines[0].credit, 10); return { id: "reversal" } as never; };
  await service.reverse("journal", "staff");
  await assert.rejects(service.reverse("journal", "staff"), { status: 400 });
});

test("customer conversion cannot follow a lead in another branch", async () => {
  const guard = new CrmScopeGuard({ customer: { findFirst: async () => ({ id: "customer", leadId: "foreign-lead" }) }, lead: { findFirst: async () => null } } as never);
  const context = { switchToHttp: () => ({ getRequest: () => ({ user, route: { path: "/api/v1/crm/customers/:id/booking" }, params: { id: "customer" }, body: {}, method: "POST" }) }) } as ExecutionContext;
  await assert.rejects(guard.canActivate(context), { status: 404 });
});

test("global finance guard denies scoped accounts even with account permission", () => {
  const guard = new GlobalFinanceGuard();
  const context = (u: AuthUser) => ({ switchToHttp: () => ({ getRequest: () => ({ user: u }) }) }) as ExecutionContext;
  assert.throws(() => guard.canActivate(context({ ...user, permissions: ["account.view"] })), { status: 403 });
  assert.equal(guard.canActivate(context(admin)), true);
});

test("invoice posting failure propagates within the invoice transaction", async () => {
  const tx = { serviceInvoice: { create: async () => ({ id: "invoice", invoiceNumber: "I1", customerId: null, branchId: null }) } };
  let usedTransaction = false;
  const controller = new FinanceController({ $transaction: async (fn: (db: typeof tx) => unknown) => fn(tx) } as never, { next: async () => "I1" } as never, {} as never, { postSale: async (input: { db: unknown }) => { usedTransaction = input.db === tx; throw new Error("posting failed"); } } as never);
  await assert.rejects(controller.createInvoice({ lines: [{ description: "Service", unitPrice: 10 }] }, request(admin)), /posting failed/);
  assert.equal(usedTransaction, true);
});

test("reversed original and reversal cancel to zero in the trial balance", async () => {
  const service = new AccountingService({ chartOfAccount: { findMany: async () => [{ id: "cash", code: "1100", name: "Cash", type: "ASSET" }] }, journalLine: { aggregate: async (arg: { where: { journal: { status: { in: string[] } } } }) => {
    const included = arg.where.journal.status.in;
    return { _sum: { debit: included.includes("REVERSED") ? 10 : 0, credit: included.includes("POSTED") ? 10 : 0 } };
  } } } as never, {} as never, {} as never);
  const result = await service.trialBalance();
  assert.equal(result.rows[0].balance, 0);
  assert.equal(result.totals.balanced, true);
});

test("business journals cannot be reversed independently of their source records", async () => {
  const tx = { journalEntry: { findUnique: async () => ({ status: "POSTED", kind: "RECEIPT" }) } };
  const service = new AccountingService({ $transaction: async (fn: (db: typeof tx) => unknown) => fn(tx) } as never, {} as never, {} as never);
  await assert.rejects(service.reverse("receipt-journal", "staff"), /source module/);
});

test("a stale draft-post request cannot overwrite a concurrently changed journal", async () => {
  let auditCalled = false;
  const tx = { $queryRaw: async () => [{ id: "a", isPosting: true, status: "ACTIVE", deletedAt: null }, { id: "b", isPosting: true, status: "ACTIVE", deletedAt: null }], journalEntry: { findUnique: async () => ({ status: "DRAFT", lines: [{ accountId: "a", debit: 10, credit: 0 }, { accountId: "b", debit: 0, credit: 10 }] }), updateMany: async () => ({ count: 0 }) } };
  const service = new AccountingService({ $transaction: async (fn: (db: typeof tx) => unknown) => fn(tx) } as never, {} as never, { log: async () => { auditCalled = true; } } as never);
  await assert.rejects(service.postExisting("changed-journal", "staff"), /status changed/);
  assert.equal(auditCalled, false);
});
