"use strict";

// Opt-in compatibility proof for a locally rebuilt recorded base, not a deployed artifact.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { randomUUID, randomBytes, createHash } = require("node:crypto");

async function main() {
  const databaseUrl = process.env.ZAT_SYNTHETIC_DATABASE_URL;
  const target = new URL(databaseUrl);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(target.hostname));
  assert.match(target.pathname, /^\/zat_synthetic_[a-z0-9_]+$/);
  const root = path.resolve(process.env.ZAT_ROLLBACK_STAGING_ROOT || "");
  assert.equal(root, path.join(os.tmpdir(), "zat-rollback-base-307d174"));
  const { PrismaClient } = require(path.join(root, "backend/node_modules/@prisma/client"));
  const bcrypt = require(path.join(root, "backend/node_modules/bcryptjs"));
  const db = new PrismaClient({ datasourceUrl: databaseUrl });
  let child;
  let log;
  try {
    const [server] = await db.$queryRaw`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(server.version >= 170000 && server.version < 180000);
    const receipt = await db.receipt.findFirstOrThrow({ where: { id: { startsWith: "request_" }, booking: { customer: { email: { endsWith: "@example.test" } } } }, orderBy: { createdAt: "desc" } });
    const booking = await db.umrahBooking.findUniqueOrThrow({ where: { id: receipt.bookingId } });
    const password = `Synthetic-${randomBytes(16).toString("hex")}!`;
    const role = await db.role.findUniqueOrThrow({ where: { name: "SUPER_ADMIN" } });
    const user = await db.user.create({ data: { username: randomUUID(), email: `${randomUUID()}@example.test`, fullName: "Synthetic rollback reviewer", passwordHash: await bcrypt.hash(password, 10), defaultBranchId: booking.branchId, roles: { create: { roleId: role.id } } } });
    const snapshot = async () => ({ receipts: await db.receipt.count(), journals: await db.journalEntry.count(), lines: await db.journalLine.count(), audits: await db.auditLog.count(), booking: await db.umrahBooking.findUnique({ where: { id: booking.id } }), receipt: await db.receipt.findUnique({ where: { id: receipt.id } }) });
    const before = await snapshot();
    for (const file of ["hostinger-start.cjs", "hostinger-api-path.cjs"]) {
      let source = fs.readFileSync(path.join(__dirname, file), "utf8");
      if (file === "hostinger-start.cjs") {
        assert.ok(source.includes('server.listen(publicPort, "0.0.0.0"'));
        source = source.replace('server.listen(publicPort, "0.0.0.0"', 'server.listen(publicPort, "127.0.0.1"');
      }
      fs.writeFileSync(path.join(root, "backend/scripts", file), source);
    }
    const listener = http.createServer();
    await new Promise(resolve => listener.listen(0, "127.0.0.1", resolve));
    const port = listener.address().port;
    await new Promise(resolve => listener.close(resolve));
    const origin = `http://127.0.0.1:${port}`;
    const env = {};
    for (const key of ["SystemRoot", "WINDIR", "TEMP", "TMP", "PATH", "USERPROFILE", "LOCALAPPDATA"]) if (process.env[key]) env[key] = process.env[key];
    Object.assign(env, { NODE_ENV: "production", DATABASE_URL: databaseUrl, JWT_SECRET: randomBytes(32).toString("hex"), JWT_REFRESH_SECRET: randomBytes(32).toString("hex"), START_MODE: "api", PORT: String(port), APP_URL: origin, COOKIE_SECURE: "false", RECEIPT_WRITES_DISABLED: "true" });
    log = fs.openSync(path.join(root, "rollback-server.log"), "w");
    child = spawn(process.execPath, [path.join(root, "backend/scripts/hostinger-start.cjs")], { cwd: root, env, stdio: ["ignore", log, log], windowsHide: true });
    const deadline = Date.now() + 30000;
    while (true) {
      try { if ((await fetch(origin + "/api/health")).status === 200) break; } catch {}
      assert.ok(Date.now() < deadline && child.exitCode === null, "Synthetic rollback gateway failed readiness");
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    const login = await fetch(origin + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify({ identifier: user.username, password }) });
    assert.equal(login.status, 201);
    const cookie = login.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
    const get = route => fetch(origin + route, { headers: { Cookie: cookie } });
    const read = await get(`/api/v1/receipts/${receipt.id}`);
    assert.equal(read.status, 200);
    const row = await read.json();
    assert.equal(row.id, receipt.id); assert.equal(row.amount, receipt.amount.toString());
    for (const mode of ["INCLUDED", "EXCLUDED"]) {
      const pdf = await get(`/api/v1/pdf/receipt/${receipt.id}?mode=${mode}`);
      assert.equal(pdf.status, 200); assert.equal(pdf.headers.get("cache-control"), "private, no-store");
      assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
    }
    assert.equal((await fetch(origin + `/api/v1/pdf/receipt/${receipt.id}`)).status, 401);
    for (const route of ["/api/v1/finance/receipts", `/api/v1/finance/receipts/${receipt.id}/review`, "/API/V1/FINANCE/RECEIPTS/"]) {
      const denied = await fetch(origin + route, { method: "POST", headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json", "Idempotency-Key": randomUUID() }, body: JSON.stringify({ bookingId: booking.id, amount: 1, method: "CASH", reviewed: true }) });
      assert.equal(denied.status, 503); assert.equal(denied.headers.get("cache-control"), "private, no-store");
    }
    assert.deepEqual(await snapshot(), before, "Rollback reads and blocked writes must not mutate financial state or reviews");
    const result = { status: "passed", syntheticOnly: true, deployedArtifactVerified: false, base: "307d174ce77a8eb7b79bd559ff1bad5ea1210c8d", baseArchiveSha256: createHash("sha256").update(fs.readFileSync(path.join(root, "source.tar"))).digest("hex"), checks: ["actual old API staff login and candidate request_ receipt read", "old receipt PDF in both price modes private/no-store", "anonymous receipt PDF denied 401", "candidate gateway blocks old API receipt/review mutations with uncached 503", "receipt, booking, journal, journal-line and audit snapshots unchanged"], paid: booking.paid.toFixed(2), balance: booking.balance.toFixed(2) };
    fs.writeFileSync(path.join(root, "rollback-result.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (child && child.exitCode === null) {
      child.kill();
      await new Promise(resolve => child.once("exit", resolve));
    }
    if (log !== undefined) fs.closeSync(log);
    await db.$disconnect();
  }
}
main().catch(() => { console.error("Synthetic rollback compatibility failed; inspect isolated staging output."); process.exitCode = 1; });
