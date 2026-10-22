import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { customerDatabase } from "../customer-db/db";

type Operation = "login" | "register";
type AuthResult = { status: number; body: { ok: boolean; error?: string } };

// PostgreSQL owns the counters so restarts and multiple web processes cannot reset them.
// Do not trust forwarding headers without a verified proxy topology. Bound both each
// normalized email and total public traffic; identifiers contain only a one-way digest.
export async function reserveCustomerAuthAttempt(operation: Operation, body: unknown, pool: Pick<Pool, "connect"> = customerDatabase()) {
  const email = body && typeof body === "object" && "email" in body && typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
  const prefix = `zat-customer:${operation}:`;
  const identifier = prefix + createHash("sha256").update(email).digest("hex");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [prefix]);
    const counts = await client.query<{ total: number; identity: number }>(
      `SELECT COUNT(*) FILTER (WHERE "createdAt" > NOW() - INTERVAL '1 minute')::int AS total,
              COUNT(*) FILTER (WHERE identifier = $1 AND success = false)::int AS identity
       FROM "LoginAttempt"
       WHERE identifier LIKE $2 AND "createdAt" > NOW() - INTERVAL '15 minutes'`,
      [identifier, prefix + "%"],
    );
    const { total, identity } = counts.rows[0];
    if (total >= (operation === "login" ? 120 : 30) || identity >= (operation === "login" ? 8 : 5)) {
      await client.query("COMMIT");
      return { allowed: false as const, retryAfter: 900 };
    }
    const id = randomUUID();
    await client.query(
      'INSERT INTO "LoginAttempt" (id, identifier, success, "createdAt") VALUES ($1, $2, false, NOW())',
      [id, identifier],
    );
    await client.query("COMMIT");
    return { allowed: true as const, id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function runCustomerAuth<T extends AuthResult>(
  operation: Operation,
  body: unknown,
  authenticate: () => Promise<T>,
  reserve = reserveCustomerAuthAttempt,
): Promise<T | AuthResult> {
  let attempt: Awaited<ReturnType<typeof reserve>>;
  try {
    attempt = await reserve(operation, body);
  } catch {
    return { status: 503, body: { ok: false, error: "Sign-in and registration are temporarily unavailable." } };
  }
  if (!attempt.allowed) return { status: 429, body: { ok: false, error: "Too many attempts. Try again in 15 minutes." } };
  const result = await authenticate();
  if (result.body.ok) {
    try {
      await customerDatabase().query('UPDATE "LoginAttempt" SET success = true WHERE id = $1', [attempt.id]);
    } catch {
      // The reservation remains counted even when outcome logging is unavailable.
      console.warn("Customer authentication outcome could not be recorded");
    }
  }
  return result;
}

