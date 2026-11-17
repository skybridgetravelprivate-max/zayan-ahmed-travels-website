import assert from "node:assert/strict";
import { test } from "node:test";
import { reserveCustomerAuthAttempt, runCustomerAuth } from "./rate-limit";

function pool(total = 0, identity = 0, fail = false) {
  const calls: { sql: string; args?: unknown[] }[] = [];
  let released = false;
  const client = {
    query: async (sql: string, args?: unknown[]) => { calls.push({ sql, args }); if (fail && sql.startsWith("SELECT COUNT")) throw Error("database down"); return { rows: [{ total, identity }] }; },
    release: () => { released = true; },
  };
  return { value: { connect: async () => client }, calls, released: () => released };
}

test("auth reservation uses a transaction-scoped database lock and hashed normalized identities", async () => {
  const p = pool();
  const result = await reserveCustomerAuthAttempt("login", { email: " PERSON@EXAMPLE.TEST " }, p.value as never);
  assert.ok(result.allowed);
  assert.equal(p.calls[0].sql, "BEGIN");
  assert.match(p.calls[1].sql, /pg_advisory_xact_lock/);
  const query = p.calls.find(c => c.sql.startsWith("SELECT COUNT"))!;
  assert.match(String(query.args?.[0]), /^zat-customer:login:[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(p.calls), /PERSON@|person@/);
  assert.ok(p.calls.some(c => c.sql.startsWith('INSERT INTO "LoginAttempt"')));
  assert.equal(p.calls.at(-1)?.sql, "COMMIT");
  assert.ok(p.released());
});

test("email and total limits deny before password work; database failures fail closed", async () => {
  for (const [operation, total, identity] of [["login", 0, 8], ["login", 120, 0], ["register", 0, 5], ["register", 30, 0]] as const) {
    const p = pool(total, identity);
    const reservation = await reserveCustomerAuthAttempt(operation, { email: "person@example.test" }, p.value as never);
    assert.equal(reservation.allowed, false);
    assert.ok(!p.calls.some(c => c.sql.startsWith("INSERT")));
  }
  let attempts = 0;
  const result = await runCustomerAuth("login", {}, async () => { attempts++; return { status: 401, body: { ok: false } }; }, async () => ({ allowed: false, retryAfter: 900 }));
  assert.equal(result.status, 429);
  const unavailable = await runCustomerAuth("login", {}, async () => { attempts++; return { status: 401, body: { ok: false } }; }, async () => { throw Error("down"); });
  assert.equal(unavailable.status, 503);
  assert.equal(attempts, 0);
});

test("recovery limits hash email or reset tokens and count successful email requests", async () => {
  const emailPool = pool();
  const emailResult = await reserveCustomerAuthAttempt("forgot-password", { email: " PERSON@EXAMPLE.TEST " }, emailPool.value as never);
  assert.ok(emailResult.allowed);
  const emailQuery = emailPool.calls.find(c => c.sql.startsWith("SELECT COUNT"))!;
  assert.match(String(emailQuery.args?.[0]), /^zat-customer:forgot-password:[a-f0-9]{64}$/);
  assert.match(emailQuery.sql, /'forgot-password' OR success = false/);
  assert.equal(emailQuery.args?.[2], "forgot-password");
  assert.doesNotMatch(JSON.stringify(emailPool.calls), /PERSON@|person@/);

  const rawToken = "synthetic-reset-token";
  const resetPool = pool();
  const resetResult = await reserveCustomerAuthAttempt("reset-password", { token: rawToken }, resetPool.value as never);
  assert.ok(resetResult.allowed);
  const resetQuery = resetPool.calls.find(c => c.sql.startsWith("SELECT COUNT"))!;
  assert.match(String(resetQuery.args?.[0]), /^zat-customer:reset-password:[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(resetPool.calls), /synthetic-reset-token/);
});

test("reservation errors roll back and release the connection", async () => {
  const p = pool(0, 0, true);
  await assert.rejects(reserveCustomerAuthAttempt("register", {}, p.value as never), /database down/);
  assert.equal(p.calls.at(-1)?.sql, "ROLLBACK");
  assert.ok(p.released());
});

