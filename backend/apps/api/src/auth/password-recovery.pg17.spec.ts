import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { AuthController } from "./auth.controller";
import { hashPassword, verifyPassword } from "../common/password";
const url = process.env.ZAT_SYNTHETIC_DATABASE_URL;
test("PG17 staff recovery lifecycle is single-use, private and session-revoking", { skip: !url }, async t => {
  const target = new URL(url!); assert.equal(target.hostname, "127.0.0.1"); assert.match(target.pathname, /^\/zat_synthetic_[a-z0-9_]+$/);
  const db = new PrismaClient({ datasourceUrl: url });
  const old = { host: process.env.SMTP_HOST, site: process.env.SITE_URL };
  const email = `${randomUUID()}@example.test`, password = "Synthetic-before-recovery!", next = "Synthetic-after-recovery!";
  let html = "", deliveries = 0;
  const mail = { send: async (_to: string, _subject: string, body: string) => { html = body; deliveries++; return { accepted: [email] }; } };
  const controller = new AuthController(db as never, {} as never, mail as never);
  const digest = (token: string) => createHash("sha256").update(token).digest("hex");
  const tokenRow = (extra = {}) => { const token = randomBytes(32).toString("hex"); return { token, data: { email, tokenHash: digest(token), expiresAt: new Date(Date.now() + 60000), ...extra } }; };
  try {
    const [server] = await db.$queryRaw<{version:number}[]>`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(server.version >= 170000 && server.version < 180000);
    const user = await db.user.create({ data: { email, username: randomUUID(), fullName: "Synthetic recovery staff", passwordHash: await hashPassword(password) } });
    process.env.SMTP_HOST = "synthetic-mocked-only.invalid"; process.env.SITE_URL = "http://127.0.0.1:55300";
    await t.test("unknown and inactive accounts use generic response without creating a token", async () => {
      const count = await db.passwordResetToken.count();
      assert.deepEqual(await controller.forgot({ email: `${randomUUID()}@example.test` }), { ok: true });
      await db.user.update({ where: { id: user.id }, data: { status: "INACTIVE" } });
      assert.deepEqual(await controller.forgot({ email }), { ok: true });
      assert.equal(await db.passwordResetToken.count(), count); assert.equal(deliveries, 0);
      await db.user.update({ where: { id: user.id }, data: { status: "ACTIVE" } });
    });
    let token = "";
    await t.test("eligible request creates only hashed token and correct reset destination", async () => {
      assert.deepEqual(await controller.forgot({ email }), { ok: true });
      const link = new URL(html.match(/href="([^"]+)"/)![1]); token = link.searchParams.get("token")!;
      assert.equal(link.origin, process.env.SITE_URL); assert.equal(link.pathname, "/reset-password"); assert.match(token, /^[a-f0-9]{64}$/);
      const saved = await db.passwordResetToken.findFirstOrThrow({ where: { tokenHash: digest(token) } });
      assert.notEqual(saved.tokenHash, token); assert.ok(saved.expiresAt > new Date()); assert.equal(saved.usedAt, null);
    });
    await t.test("weak, malformed and expired tokens cannot mutate password", async () => {
      await assert.rejects(controller.reset({ token, password: "short" }));
      await assert.rejects(controller.reset({ token: "bad", password: next }));
      const expired = tokenRow({ expiresAt: new Date(0) }); await db.passwordResetToken.create({ data: expired.data });
      await assert.rejects(controller.reset({ token: expired.token, password: next }));
      assert.ok(await verifyPassword(password, (await db.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash));
      assert.equal((await db.passwordResetToken.findFirstOrThrow({ where: { tokenHash: digest(token) } })).usedAt, null);
    });
    await t.test("simultaneous reset commits once, revokes all sessions and sibling tokens", async () => {
      const sibling = tokenRow(); await db.passwordResetToken.create({ data: sibling.data });
      await db.session.create({ data: { userId: user.id, refreshTokenHash: "synthetic", expiresAt: new Date(Date.now() + 60000) } });
      const outcomes = await Promise.allSettled([controller.reset({ token, password: next }), controller.reset({ token, password: next })]);
      assert.equal(outcomes.filter(o => o.status === "fulfilled").length, 1);
      assert.ok(await verifyPassword(next, (await db.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash));
      assert.equal(await db.session.count({ where: { userId: user.id, revokedAt: null } }), 0);
      assert.equal(await db.passwordResetToken.count({ where: { email, usedAt: null } }), 0);
      await assert.rejects(controller.reset({ token, password }));
    });
    await t.test("failed delivery gives generic response and invalidates unissued token", async () => {
      const failing = new AuthController(db as never, {} as never, { send: async () => { throw Error("private-provider-message"); } } as never);
      const logs: unknown[][] = []; const mock = t.mock.method(console, "warn", (...args: unknown[]) => logs.push(args));
      try { assert.deepEqual(await failing.forgot({ email }), { ok: true }); assert.equal(await db.passwordResetToken.count({ where: { email, usedAt: null } }), 0); assert.doesNotMatch(JSON.stringify(logs), /private-provider-message|@example/); } finally { mock.mock.restore(); }
    });
    await t.test("disabled account reset rolls back token claim", async () => {
      const disabled = tokenRow(); await db.passwordResetToken.create({ data: disabled.data });
      await db.user.update({ where: { id: user.id }, data: { status: "INACTIVE" } });
      await assert.rejects(controller.reset({ token: disabled.token, password: next }));
      assert.equal((await db.passwordResetToken.findFirstOrThrow({ where: { tokenHash: disabled.data.tokenHash } })).usedAt, null);
    });
  } finally {
    if (old.host === undefined) delete process.env.SMTP_HOST; else process.env.SMTP_HOST = old.host;
    if (old.site === undefined) delete process.env.SITE_URL; else process.env.SITE_URL = old.site;
    await db.$disconnect();
  }
});
