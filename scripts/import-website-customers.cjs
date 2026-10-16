"use strict";

/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { Pool } = require("pg");
const { loadEnvConfig } = require("@next/env");
const { createPostgresConnectionConfig } = require("../backend/packages/config/postgres-tls.cjs");

const root = path.resolve(__dirname, "..");
loadEnvConfig(root);

function argumentsFrom(argv) {
  let source = path.join(root, "data", "customers.sqlite");
  let apply = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--apply") {
      apply = true;
    } else if (argv[index] === "--source" && argv[index + 1]) {
      source = path.resolve(argv[++index]);
    } else {
      throw new Error("Usage: node scripts/import-website-customers.cjs [--source <sqlite-file>] [--apply]");
    }
  }
  return { source, apply };
}

function readSource(filename) {
  if (!fs.existsSync(filename)) throw new Error("SQLite source file does not exist.");
  const db = new DatabaseSync(filename, { readOnly: true });
  try {
    db.exec("BEGIN");
    const integrity = db.prepare("PRAGMA integrity_check").all();
    if (integrity.length !== 1 || integrity[0].integrity_check !== "ok") {
      throw new Error("SQLite integrity check failed; import was not started.");
    }
    const tables = new Set(
      db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .all()
        .map((row) => row.name),
    );
    if (!tables.has("customers") || !tables.has("sessions")) {
      throw new Error("SQLite source is missing the expected customer/session tables.");
    }

    const customers = db
      .prepare(
        `SELECT id, email, password_hash, display_name, crm_customer_id, created_at, updated_at
         FROM customers ORDER BY id`,
      )
      .all();
    const sessions = db
      .prepare(
        `SELECT id, customer_id, token_hash, expires_at, created_at
         FROM sessions ORDER BY id`,
      )
      .all();
    return { customers, sessions };
  } finally {
    try {
      db.exec("ROLLBACK");
    } finally {
      db.close();
    }
  }
}

function normalizedDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function customerValues(row) {
  const email = String(row.email ?? "");
  return {
    id: String(row.id ?? ""),
    email,
    passwordHash: String(row.password_hash ?? ""),
    displayName: String(row.display_name ?? ""),
    crmCustomerId: row.crm_customer_id === null ? null : String(row.crm_customer_id ?? ""),
    createdAt: normalizedDate(row.created_at),
    updatedAt: normalizedDate(row.updated_at),
  };
}

function sessionValues(row) {
  return {
    id: String(row.id ?? ""),
    customerId: String(row.customer_id ?? ""),
    tokenHash: String(row.token_hash ?? ""),
    expiresAt: normalizedDate(row.expires_at),
    revokedAt: null,
    createdAt: normalizedDate(row.created_at),
  };
}

function sameCustomer(row, customer) {
  return (
    row.id === customer.id &&
    row.email === customer.email &&
    row.password_hash === customer.passwordHash &&
    row.display_name === customer.displayName &&
    row.crm_customer_id === customer.crmCustomerId &&
    normalizedDate(row.created_at) === customer.createdAt &&
    normalizedDate(row.updated_at) === customer.updatedAt
  );
}

function sameSession(row, session) {
  return (
    row.id === session.id &&
    row.customer_id === session.customerId &&
    row.token_hash === session.tokenHash &&
    normalizedDate(row.expires_at) === session.expiresAt &&
    normalizedDate(row.revoked_at) === session.revokedAt &&
    normalizedDate(row.created_at) === session.createdAt
  );
}

async function inspectAndImport({ source, apply }) {
  const { customers: sourceCustomerRows, sessions: sourceSessionRows } = readSource(source);
  const customers = sourceCustomerRows.map(customerValues);
  const sessions = sourceSessionRows.map(sessionValues);
  const conflictCounts = {
    invalid_customer_rows: 0,
    duplicate_normalized_emails: 0,
    customer_id_conflicts: 0,
    customer_email_conflicts: 0,
    invalid_session_rows: 0,
    missing_session_customers: 0,
    session_id_conflicts: 0,
    session_token_hash_conflicts: 0,
  };
  const emailCounts = new Map();
  const customerIds = new Set(customers.map((row) => row.id));
  const insertedCustomers = [];
  const insertedSessions = [];
  let existingCustomers = 0;
  let existingSessions = 0;

  for (const customer of customers) {
    if (
      !customer.id ||
      !customer.email ||
      customer.email !== customer.email.trim().toLowerCase() ||
      !customer.passwordHash ||
      !customer.displayName ||
      !customer.createdAt ||
      !customer.updatedAt
    ) {
      conflictCounts.invalid_customer_rows += 1;
      continue;
    }
    emailCounts.set(customer.email, (emailCounts.get(customer.email) ?? 0) + 1);
  }
  for (const count of emailCounts.values()) {
    if (count > 1) conflictCounts.duplicate_normalized_emails += count - 1;
  }

  for (const session of sessions) {
    if (!session.id || !session.customerId || !/^[a-f0-9]{64}$/.test(session.tokenHash) ||
      !session.expiresAt || !session.createdAt) {
      conflictCounts.invalid_session_rows += 1;
    }
    if (!customerIds.has(session.customerId)) conflictCounts.missing_session_customers += 1;
  }

  const connectionString =
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    "";
  if (!connectionString) throw new Error("Set DATABASE_URL privately before running the import command.");
  const config = createPostgresConnectionConfig(connectionString);
  const pool = new Pool({ ...config, max: 1, connectionTimeoutMillis: 15_000 });
  let client;

  try {
    client = await pool.connect();
    await client.query(apply ? "BEGIN ISOLATION LEVEL SERIALIZABLE" : "BEGIN READ ONLY");

    for (const customer of customers) {
      const matches = await client.query(
        `SELECT id, email, password_hash, display_name, crm_customer_id, created_at, updated_at
         FROM website_customers WHERE id = $1 OR email = $2`,
        [customer.id, customer.email],
      );
      if (matches.rows.length) {
        if (matches.rows.length === 1 && sameCustomer(matches.rows[0], customer)) {
          existingCustomers += 1;
        } else {
          for (const row of matches.rows) {
            if (row.id === customer.id) conflictCounts.customer_id_conflicts += 1;
            if (row.email === customer.email) conflictCounts.customer_email_conflicts += 1;
          }
        }
      } else {
        insertedCustomers.push(customer);
      }
    }

    for (const session of sessions) {
      const matches = await client.query(
        `SELECT id, customer_id, token_hash, expires_at, revoked_at, created_at
         FROM website_customer_sessions WHERE id = $1 OR token_hash = $2`,
        [session.id, session.tokenHash],
      );
      if (matches.rows.length) {
        if (matches.rows.length === 1 && sameSession(matches.rows[0], session)) {
          existingSessions += 1;
        } else {
          for (const row of matches.rows) {
            if (row.id === session.id) conflictCounts.session_id_conflicts += 1;
            if (row.token_hash === session.tokenHash) conflictCounts.session_token_hash_conflicts += 1;
          }
        }
      } else {
        insertedSessions.push(session);
      }
    }

    const conflicts = Object.values(conflictCounts).some((count) => count > 0);
    console.log(`SOURCE_CUSTOMERS=${customers.length}`);
    console.log(`SOURCE_SESSIONS=${sessions.length}`);
    console.log(`CUSTOMERS_ALREADY_PRESENT=${existingCustomers}`);
    console.log(`SESSIONS_ALREADY_PRESENT=${existingSessions}`);
    console.log(`CUSTOMERS_TO_IMPORT=${insertedCustomers.length}`);
    console.log(`SESSIONS_TO_IMPORT=${insertedSessions.length}`);
    for (const [name, count] of Object.entries(conflictCounts)) {
      if (count) console.log(`CONFLICT_${name.toUpperCase()}=${count}`);
    }

    if (conflicts) {
      await client.query("ROLLBACK");
      console.log("IMPORT_STATUS=BLOCKED_CONFLICTS");
      process.exitCode = 2;
      return;
    }
    if (!apply) {
      await client.query("ROLLBACK");
      console.log("IMPORT_STATUS=DRY_RUN_NO_WRITES");
      return;
    }

    for (const customer of insertedCustomers) {
      await client.query(
        `INSERT INTO website_customers
         (id, email, password_hash, display_name, crm_customer_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          customer.id,
          customer.email,
          customer.passwordHash,
          customer.displayName,
          customer.crmCustomerId,
          customer.createdAt,
          customer.updatedAt,
        ],
      );
    }
    for (const session of insertedSessions) {
      await client.query(
        `INSERT INTO website_customer_sessions
         (id, customer_id, token_hash, expires_at, revoked_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          session.id,
          session.customerId,
          session.tokenHash,
          session.expiresAt,
          session.revokedAt,
          session.createdAt,
        ],
      );
    }

    const customerCount = await client.query(
      `SELECT COUNT(*)::int AS count FROM website_customers WHERE id = ANY($1::text[])`,
      [customers.map((row) => row.id)],
    );
    const sessionCount = await client.query(
      `SELECT COUNT(*)::int AS count FROM website_customer_sessions WHERE id = ANY($1::text[])`,
      [sessions.map((row) => row.id)],
    );
    const verifiedCustomers = customerCount.rows[0].count;
    const verifiedSessions = sessionCount.rows[0].count;
    console.log(`VERIFIED_SOURCE_CUSTOMERS_PRESENT=${verifiedCustomers}`);
    console.log(`VERIFIED_SOURCE_SESSIONS_PRESENT=${verifiedSessions}`);
    if (verifiedCustomers !== customers.length || verifiedSessions !== sessions.length) {
      throw new Error("Post-import count verification failed; transaction will be rolled back.");
    }

    await client.query("COMMIT");
    console.log("IMPORT_STATUS=COMMITTED");
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Keep the original database error as the reported failure.
      }
    }
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

inspectAndImport(argumentsFrom(process.argv.slice(2))).catch((error) => {
  const safeMessage =
    error instanceof Error && error.message.includes("DATABASE_URL")
      ? error.message
      : "Import failed; no customer data was printed.";
  console.error(safeMessage);
  process.exitCode = 1;
});
