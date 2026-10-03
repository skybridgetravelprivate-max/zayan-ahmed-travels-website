import "server-only";

import { randomUUID } from "node:crypto";
import { customerDatabase } from "@/server/customer-db/db";

export type CustomerRecord = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export type SessionRecord = {
  id: string;
  customerId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
};

export class CustomerRecordError extends Error {
  readonly code: "email-taken" | "session-token-taken" | "invalid";

  constructor(message: string, code: "email-taken" | "session-token-taken" | "invalid" = "invalid") {
    super(message);
    this.code = code;
  }
}

type CustomerRow = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  created_at: string;
  updated_at: string;
};

type SessionRow = {
  id: string;
  customer_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
};

function text(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new CustomerRecordError(`${label} is required.`);
  return trimmed;
}

function normalizeEmail(email: string) {
  return text(email, "Email").toLowerCase();
}

function isUniqueConstraint(error: unknown) {
  return error instanceof Error && "errcode" in error && error.errcode === 2067;
}

function customerFromRow(row: CustomerRow): CustomerRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sessionFromRow(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    customerId: row.customer_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export function insertCustomer(input: {
  email: string;
  passwordHash: string;
  displayName: string;
}): CustomerRecord {
  const email = normalizeEmail(input.email);
  const passwordHash = text(input.passwordHash, "Password hash");
  const displayName = text(input.displayName, "Display name");
  const now = new Date().toISOString();
  const record: CustomerRecord = {
    id: randomUUID(),
    email,
    passwordHash,
    displayName,
    createdAt: now,
    updatedAt: now,
  };
  const db = customerDatabase();

  try {
    db.prepare(
      `INSERT INTO customers (id, email, password_hash, display_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(record.id, record.email, record.passwordHash, record.displayName, record.createdAt, record.updatedAt);
  } catch (error) {
    if (isUniqueConstraint(error)) {
      throw new CustomerRecordError("A customer with this email already exists.", "email-taken");
    }
    throw error;
  }

  return record;
}

export function findCustomerById(id: string): CustomerRecord | null {
  const row = customerDatabase()
    .prepare(
      `SELECT id, email, password_hash, display_name, created_at, updated_at
       FROM customers WHERE id = ?`,
    )
    .get(text(id, "Customer id")) as CustomerRow | undefined;
  return row ? customerFromRow(row) : null;
}

export function findCustomerByEmail(email: string): CustomerRecord | null {
  const row = customerDatabase()
    .prepare(
      `SELECT id, email, password_hash, display_name, created_at, updated_at
       FROM customers WHERE email = ?`,
    )
    .get(normalizeEmail(email)) as CustomerRow | undefined;
  return row ? customerFromRow(row) : null;
}

export function insertSession(input: {
  customerId: string;
  tokenHash: string;
  expiresAt: string;
}): SessionRecord {
  const record: SessionRecord = {
    id: randomUUID(),
    customerId: text(input.customerId, "Customer id"),
    tokenHash: text(input.tokenHash, "Token hash"),
    expiresAt: text(input.expiresAt, "Expiry"),
    createdAt: new Date().toISOString(),
  };
  const db = customerDatabase();

  try {
    db.prepare(
      `INSERT INTO sessions (id, customer_id, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(record.id, record.customerId, record.tokenHash, record.expiresAt, record.createdAt);
  } catch (error) {
    if (isUniqueConstraint(error)) {
      throw new CustomerRecordError("A session with this token hash already exists.", "session-token-taken");
    }
    throw error;
  }

  return record;
}

export function deleteSessionByTokenHash(tokenHash: string) {
  customerDatabase().prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(text(tokenHash, "Token hash"));
}

export function deleteExpiredSessions(nowIso: string) {
  customerDatabase().prepare(`DELETE FROM sessions WHERE expires_at <= ?`).run(text(nowIso, "Expiry"));
}

export function findSessionByTokenHash(tokenHash: string): SessionRecord | null {
  const row = customerDatabase()
    .prepare(
      `SELECT id, customer_id, token_hash, expires_at, created_at
       FROM sessions WHERE token_hash = ?`,
    )
    .get(text(tokenHash, "Token hash")) as SessionRow | undefined;
  return row ? sessionFromRow(row) : null;
}
