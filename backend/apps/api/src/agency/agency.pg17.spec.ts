import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { JwtService } from "@nestjs/jwt";
import { PrismaClient } from "@prisma/client";
// Nest needs emitted constructor metadata; exercise the real compiled HTTP app.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Load tsc output so Nest constructor metadata matches production.
const { createNestApp } = require("../../dist/create-app") as typeof import("../create-app");
import { hashPassword } from "../common/password";
import { AgencyService } from "./agency.service";
import { AuditService } from "../common/audit.service";

test("PG17 agency HTTP acceptance: identity, scope, durable requests, review and revocation", { skip: !process.env.ZAT_SYNTHETIC_DATABASE_URL }, async t => {
  const target = new URL(process.env.ZAT_SYNTHETIC_DATABASE_URL!);
  assert.equal(target.hostname, "127.0.0.1"); assert.match(target.pathname, /^\/zat_synthetic_/);
  assert.equal(process.env.DATABASE_URL, target.href.replace(/\/$/, ""));
  process.env.AGENT_PORTAL_ENABLED = "true";
  const db = new PrismaClient({ datasourceUrl: process.env.ZAT_SYNTHETIC_DATABASE_URL });
  const [version] = await db.$queryRaw<{ version: number }[]>`SELECT current_setting('server_version_num')::int AS version`;
  assert.ok(version.version >= 170000 && version.version < 180000);
  const suffix = randomUUID();
  const password = `Synthetic-only-${randomUUID()}`;
  const passwordHash = await hashPassword(password);
  const branchA = await db.branch.create({ data: { code: suffix + "a", name: "Synthetic agency A branch" } });
  const branchB = await db.branch.create({ data: { code: suffix + "b", name: "Synthetic agency B branch" } });
  const agentA = await db.agent.create({ data: { name: "Synthetic Agency A", branchId: branchA.id } });
  const agentB = await db.agent.create({ data: { name: "Synthetic Agency B", branchId: branchB.id } });
  const user = async (name: string) => db.user.create({ data: { email: `${name}-${suffix}@example.test`, username: name + suffix, fullName: name, passwordHash } });
  const a = await user("Agent A"), a2 = await user("Agent A colleague"), b = await user("Agent B"), staff = await user("Internal reviewer");
  await db.agencyMembership.createMany({ data: [{ userId: a.id, agentId: agentA.id }, { userId: a2.id, agentId: agentA.id }, { userId: b.id, agentId: agentB.id }] });
  const role = await db.role.create({ data: { name: `SyntheticReviewer-${suffix}` } });
  for (const code of ["agent.view", "agent.edit"]) {
    const permission = await db.permission.upsert({ where: { code }, update: {}, create: { code } });
    await db.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
  }
  await db.userRole.create({ data: { userId: staff.id, roleId: role.id } });
  await db.userBranch.create({ data: { userId: staff.id, branchId: branchA.id } });
  const app = await createNestApp(); await app.listen(0, "127.0.0.1");
  const base = await app.getUrl();
  let loginCounter = 0;
  const login = async (u: typeof a, portal: string = "agent", supplied = password) => {
    const response = await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": `127.2.0.${++loginCounter}` }, body: JSON.stringify({ identifier: u.email, password: supplied, portal }) });
    return { response, cookie: response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ") };
  };
  const call = (cookie: string, path: string, method = "GET", body?: unknown, key?: string) => fetch(base + path, { method, headers: { Cookie: cookie, "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    const authA = await login(a), authA2 = await login(a2), authB = await login(b), authStaff = await login(staff, "staff");
    assert.equal(authA.response.status, 201); assert.equal(authB.response.status, 201); assert.equal(authStaff.response.status, 201);
    await t.test("wrong portal, password and nonmember issue no cookies", async () => {
      for (const [u, portal, pass] of [[a, "staff", password], [staff, "agent", password], [a, "agent", "wrong"]] as const) {
        const denied = await login(u, portal, pass); assert.equal(denied.response.status, 401); assert.equal(denied.cookie, "");
      }
      const malformed = await login(a, "invalid"); assert.equal(malformed.response.status, 400); assert.equal(malformed.cookie, "");
    });
    await t.test("inactive, locked, mixed-role, expired and legacy-audience sessions fail closed", async () => {
      for (const status of ["INACTIVE", "LOCKED"] as const) {
        await db.user.update({ where: { id: a2.id }, data: { status } });
        const denied = await login(a2); assert.equal(denied.response.status, 401); assert.equal(denied.cookie, "");
      }
      await db.user.update({ where: { id: a2.id }, data: { status: "ACTIVE", lockedUntil: new Date(Date.now() + 60000) } });
      assert.equal((await login(a2)).cookie, "");
      await db.user.update({ where: { id: a2.id }, data: { lockedUntil: null } });
      await db.userRole.create({ data: { userId: a2.id, roleId: role.id } });
      assert.equal((await login(a2)).cookie, "");
      await db.userRole.delete({ where: { userId_roleId: { userId: a2.id, roleId: role.id } } });
      const session = await db.session.findFirstOrThrow({ where: { userId: a2.id }, orderBy: { createdAt: "desc" } });
      const jwt = app.get(JwtService);
      const oldToken = await jwt.signAsync({ sub: a2.id, sid: session.id, portal: "staff" }, { secret: process.env.JWT_SECRET, expiresIn: 60 });
      await db.session.update({ where: { id: session.id }, data: { audience: "staff" } });
      assert.equal((await call(`access_token=${oldToken}`, "/api/v1/agent/me")).status, 401);
      await db.session.update({ where: { id: session.id }, data: { audience: "agent", expiresAt: new Date(Date.now() - 1000) } });
      assert.equal((await call(authA2.cookie, "/api/v1/agent/me")).status, 401);
      await db.session.update({ where: { id: session.id }, data: { expiresAt: session.expiresAt } });
      const expired = await jwt.signAsync({ sub: a2.id, sid: session.id, portal: "agent" }, { secret: process.env.JWT_SECRET, expiresIn: -1 });
      assert.equal((await call(`access_token=${expired}`, "/api/v1/agent/me")).status, 401);
    });
    const body = { kind: "ENQUIRY", subject: "Synthetic Umrah request", message: "Synthetic dates and preferences; no real booking requested." };
    const key = randomUUID(); let requestId = "";
    await t.test("concurrent retries across same-agency users create one request and one audit record", async () => {
      const results = await Promise.all([call(authA.cookie, "/api/v1/agent/requests", "POST", body, key), call(authA2.cookie, "/api/v1/agent/requests", "POST", body, key)]);
      for (const result of results) assert.equal(result.status, 201);
      const rows = await Promise.all(results.map(result => result.json())); assert.equal(rows[0].id, rows[1].id); requestId = rows[0].id;
      assert.equal(await db.agencyRequest.count({ where: { agentId: agentA.id, requestKey: key } }), 1);
      assert.equal(await db.auditLog.count({ where: { entityId: requestId, action: "agency.request" } }), 1);
      assert.equal((await call(authA.cookie, "/api/v1/agent/requests", "POST", { ...body, message: "Changed" }, key)).status, 409);
      assert.equal((await call(authA.cookie, "/api/v1/agent/requests", "POST", body, randomUUID())).status, 201);
    });
    await t.test("foreign IDs, injected ownership and internal APIs are denied", async () => {
      assert.equal((await call(authB.cookie, `/api/v1/agent/requests/${requestId}`)).status, 404);
      assert.equal((await call(authA.cookie, "/api/v1/agent/requests", "POST", { ...body, agentId: agentB.id }, randomUUID())).status, 400);
      for (const path of ["/api/auth/me", "/api/v1/management/modules", "/api/v1/agency-review", "/api/v1/reports/catalog", "/api/v1/documents/foreign"]) assert.equal((await call(authA.cookie, path)).status, 401);
      const own = await (await call(authB.cookie, "/api/v1/agent/requests")).json(); assert.equal(own.total, 0);
    });
    await t.test("quotations are agency/branch scoped and never expose costs or draft notes", async () => {
      await db.quotation.createMany({ data: [
        { quotationNumber: "SYN-RELEASED-" + suffix, agentId: agentA.id, branchId: branchA.id, status: "SENT", net: "99999999999999.99", costTotal: "5.00", notes: "INTERNAL SECRET" },
        { quotationNumber: "SYN-DRAFT-" + suffix, agentId: agentA.id, branchId: branchA.id, status: "DRAFT" },
        { quotationNumber: "SYN-FOREIGN-" + suffix, agentId: agentB.id, branchId: branchB.id, status: "SENT" },
      ] });
      const response = await call(authA.cookie, "/api/v1/agent/quotations"); assert.equal(response.status, 200);
      const data = await response.json(); assert.equal(data.total, 1); assert.equal(data.rows[0].net, "99999999999999.99");
      assert.ok(!JSON.stringify(data).includes("costTotal")); assert.ok(!JSON.stringify(data).includes("INTERNAL SECRET"));
    });
    await t.test("reviewers cannot see another branch and replies do not execute bookings or payments", async () => {
      const foreign = await new AgencyService(db as never, new AuditService(db as never)).submit(b.id, body, randomUUID());
      const queue = await (await call(authStaff.cookie, "/api/v1/agency-review")).json(); assert.ok(queue.rows.every((row: { agent: { name: string } }) => row.agent.name === agentA.name));
      const row = queue.rows.find((row: { id: string }) => row.id === requestId);
      assert.equal((await call(authStaff.cookie, `/api/v1/agency-review/${foreign.id}/reply`, "POST", { publicReply: "Denied", version: foreign.updatedAt.toISOString() })).status, 404);
      const before = await db.receipt.count();
      assert.equal((await call(authStaff.cookie, `/api/v1/agency-review/${requestId}/reply`, "POST", { publicReply: "Please provide departure city. No booking confirmed.", version: row.updatedAt })).status, 201);
      assert.equal(await db.receipt.count(), before);
      const own = await (await call(authA.cookie, `/api/v1/agent/requests/${requestId}`)).json(); assert.match(own.reply, /departure city/);
    });
    await t.test("linked enquiry follows exact staff quotation and booking workflow without cross-agency exposure", async () => {
      const lead = await db.lead.create({ data: { leadNumber: "SYN-LINK-" + suffix, fullName: "Synthetic traveller", mobile: "+000", branchId: branchA.id, assignedAgentId: agentA.id, budget: "9007199254740991.01" } });
      assert.equal((await call(authStaff.cookie, `/api/v1/agency-review/${requestId}/lead`, "POST", { leadReference: lead.leadNumber })).status, 403);
      for (const code of ["lead.view", "quotation.create", "quotation.edit", "booking.create"]) {
        const permission = await db.permission.upsert({ where: { code }, update: {}, create: { code } });
        await db.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
      }
      const link = () => call(authStaff.cookie, `/api/v1/agency-review/${requestId}/lead`, "POST", { leadReference: lead.leadNumber });
      const linked = await Promise.all([link(), link()]);
      linked.forEach(response => assert.equal(response.status, 201));
      assert.equal(await db.auditLog.count({ where: { entityId: requestId, action: "agency.link-lead" } }), 1);
      const quoteResponse = await call(authStaff.cookie, `/api/v1/crm/leads/${lead.id}/quotation`, "POST");
      assert.equal(quoteResponse.status, 201);
      const quote = await quoteResponse.json(); assert.equal(quote.net, "9007199254740991.01");
      assert.equal((await db.quotationItem.findFirstOrThrow({ where: { quotationId: quote.id } })).sellingPrice.toFixed(2), "9007199254740991.01");
      await db.quotation.update({ where: { id: quote.id }, data: { status: "SENT" } });
      const visible = await (await call(authA.cookie, `/api/v1/agent/requests/${requestId}`)).json();
      assert.equal(visible.operationalReference, lead.leadNumber); assert.match(visible.quotationReferences, /SENT/);
      assert.ok(!("leadId" in visible));
      assert.equal((await call(authB.cookie, `/api/v1/agent/requests/${requestId}`)).status, 404);
      for (const [code, type] of [["1300", "ASSET"], ["4100", "REVENUE"]] as const) {
        await db.chartOfAccount.upsert({ where: { code }, update: {}, create: { code, name: "Synthetic agency " + code, type } });
      }
      await db.quotation.update({ where: { id: quote.id }, data: { currency: "USD" } });
      const beforeRejectedCurrency = { bookings: await db.umrahBooking.count(), journals: await db.journalEntry.count(), audits: await db.auditLog.count() };
      assert.equal((await call(authStaff.cookie, `/api/v1/crm/leads/${lead.id}/booking`, "POST")).status, 400);
      assert.deepEqual({ bookings: await db.umrahBooking.count(), journals: await db.journalEntry.count(), audits: await db.auditLog.count() }, beforeRejectedCurrency);
      assert.equal((await db.quotation.findUniqueOrThrow({ where: { id: quote.id } })).status, "SENT");
      await db.quotation.update({ where: { id: quote.id }, data: { currency: "PKR" } });
      const booked = await call(authStaff.cookie, `/api/v1/crm/leads/${lead.id}/booking`, "POST");
      assert.equal(booked.status, 201, await booked.clone().text());
      const booking = await booked.json(); assert.equal(booking.net, "9007199254740991.01"); assert.equal(booking.profit, "9007199254740991.01");
      const journal = await db.journalEntry.findFirstOrThrow({ where: { sourceId: booking.id, module: "umrah" }, include: { lines: true } });
      assert.equal(journal.lines[0].debit.plus(journal.lines[1].debit).toFixed(2), "9007199254740991.01");
      assert.equal(journal.lines[0].debit.plus(journal.lines[1].debit).minus(journal.lines[0].credit).minus(journal.lines[1].credit).toFixed(2), "0.00");
      const list = await (await call(authA.cookie, "/api/v1/agent/bookings")).json(); assert.ok(list.umrah.some((row: { id: string }) => row.id === booking.id));
      const filtered = await (await call(authA.cookie, `/api/v1/agent/bookings?q=${encodeURIComponent(booking.bookingNumber)}&status=CONFIRMED&service=umrah`)).json();
      assert.equal(filtered.total, 1); assert.equal(filtered.umrah[0].id, booking.id);
      const incompatible = await (await call(authA.cookie, "/api/v1/agent/bookings?status=ISSUED&service=umrah")).json(); assert.equal(incompatible.total, 0);
      for (const query of ["from=2050-02-30", "from=2030-01-02&to=2030-01-01", "service=unknown", "page=0", "status=UNKNOWN"]) assert.equal((await call(authA.cookie, "/api/v1/agent/bookings?" + query)).status, 400);
      const pagePrefix = "SYN-PAGE-" + suffix;
      await db.umrahBooking.createMany({ data: Array.from({ length: 31 }, (_, i) => ({ bookingNumber: pagePrefix + i, customerId: booking.customerId, agentId: agentA.id, branchId: branchA.id, createdAt: new Date("2030-01-01T23:59:59Z") })) });
      const secondPage = await (await call(authA.cookie, `/api/v1/agent/bookings?q=${pagePrefix}&page=2&from=2030-01-01&to=2030-01-01&service=umrah`)).json();
      assert.equal(secondPage.total, 31); assert.equal(secondPage.umrah.length, 1); assert.equal(secondPage.hasNext, false);
      const otherAgency = await (await call(authB.cookie, `/api/v1/agent/bookings?q=${pagePrefix}`)).json(); assert.equal(otherAgency.total, 0);
      await db.agent.update({ where: { id: agentA.id }, data: { branchId: branchB.id } });
      const hidden = await (await call(authA.cookie, `/api/v1/agent/requests/${requestId}`)).json(); assert.equal(hidden.operationalReference, null); assert.equal(hidden.quotationReferences, null);
      const moved = await (await call(authA.cookie, "/api/v1/agent/bookings")).json(); assert.ok(!moved.umrah.some((row: { id: string }) => row.id === booking.id));
      await db.agent.update({ where: { id: agentA.id }, data: { branchId: branchA.id } });
      const unrelated = await db.lead.create({ data: { leadNumber: "SYN-FOREIGN-LINK-" + suffix, fullName: "Synthetic other agency", mobile: "+000", branchId: branchB.id, assignedAgentId: agentB.id } });
      assert.equal((await call(authStaff.cookie, `/api/v1/agency-review/${requestId}/lead`, "POST", { leadReference: unrelated.leadNumber })).status, 404);
    });
    await t.test("late audit failure rolls back the agency request", async () => {
      const service = new AgencyService(db as never, { log: async () => { throw Error("synthetic audit failure"); } } as never);
      const rollbackKey = randomUUID();
      await assert.rejects(service.submit(a.id, body, rollbackKey), /synthetic audit failure/);
      assert.equal(await db.agencyRequest.count({ where: { requestKey: rollbackKey } }), 0);
    });
    await t.test("refresh preserves external audience; revoked membership and session fail immediately", async () => {
      const refreshed = await call(authA.cookie, "/api/auth/refresh", "POST"); assert.equal(refreshed.status, 201);
      const refreshedCookie = refreshed.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
      assert.equal((await call(refreshedCookie, "/api/v1/management/modules")).status, 401);
      assert.equal((await call(refreshedCookie, "/api/v1/agent/me")).status, 200);
      await db.agencyMembership.update({ where: { userId: a.id }, data: { active: false } });
      assert.equal((await call(refreshedCookie, "/api/v1/agent/me")).status, 401);
      await call(authB.cookie, "/api/auth/logout", "POST");
      assert.equal((await call(authB.cookie, "/api/v1/agent/me")).status, 401);
      process.env.AGENT_PORTAL_ENABLED = "false";
      assert.equal((await login(a2)).response.status, 503);
    });
  } finally { await app.close(); await db.$disconnect(); }
});
