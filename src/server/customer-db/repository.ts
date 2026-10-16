import "server-only";

import { randomUUID } from "node:crypto";
import { customerDatabase } from "@/server/customer-db/db";

export type CustomerRecord = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  crmCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SessionRecord = {
  id: string;
  customerId: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
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
  crm_customer_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type SessionRow = {
  id: string;
  customer_id: string;
  token_hash: string;
  expires_at: Date | string;
  revoked_at: Date | string | null;
  created_at: Date | string;
};

function text(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new CustomerRecordError(`${label} is required.`);
  return trimmed;
}

function normalizeEmail(email: string) {
  return text(email, "Email").toLowerCase();
}

function isUniqueConstraint(error: unknown, constraint: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    error.constraint === constraint
  );
}

function timestamp(value: Date | string | null) {
  if (value === null) return null;
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function customerFromRow(row: CustomerRow): CustomerRecord {
  const crm = typeof row.crm_customer_id === "string" ? row.crm_customer_id.trim() : "";
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    crmCustomerId: crm || null,
    createdAt: timestamp(row.created_at)!,
    updatedAt: timestamp(row.updated_at)!,
  };
}

function sessionFromRow(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    customerId: row.customer_id,
    tokenHash: row.token_hash,
    expiresAt: timestamp(row.expires_at)!,
    revokedAt: timestamp(row.revoked_at),
    createdAt: timestamp(row.created_at)!,
  };
}

const customerSelect = `id, email, password_hash, display_name, crm_customer_id, created_at, updated_at`;

export async function insertCustomer(input: {
  email: string;
  passwordHash: string;
  displayName: string;
}): Promise<CustomerRecord> {
  const email = normalizeEmail(input.email);
  const passwordHash = text(input.passwordHash, "Password hash");
  const displayName = text(input.displayName, "Display name");
  const now = new Date().toISOString();
  const record: CustomerRecord = {
    id: randomUUID(),
    email,
    passwordHash,
    displayName,
    crmCustomerId: null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await customerDatabase().query(
      `INSERT INTO website_customers (id, email, password_hash, display_name, crm_customer_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NULL, $5, $6)`,
      [record.id, record.email, record.passwordHash, record.displayName, record.createdAt, record.updatedAt],
    );
  } catch (error) {
    if (isUniqueConstraint(error, "website_customers_email_key")) {
      throw new CustomerRecordError("A customer with this email already exists.", "email-taken");
    }
    throw error;
  }

  return record;
}

export async function findCustomerById(id: string): Promise<CustomerRecord | null> {
  const result = await customerDatabase().query<CustomerRow>(
    `SELECT ${customerSelect} FROM website_customers WHERE id = $1`,
    [text(id, "Customer id")],
  );
  const row = result.rows[0];
  return row ? customerFromRow(row) : null;
}

export async function findCustomerByEmail(email: string): Promise<CustomerRecord | null> {
  const result = await customerDatabase().query<CustomerRow>(
    `SELECT ${customerSelect} FROM website_customers WHERE email = $1`,
    [normalizeEmail(email)],
  );
  const row = result.rows[0];
  return row ? customerFromRow(row) : null;
}

export async function setCustomerCrmId(customerId: string, crmCustomerId: string): Promise<void> {
  const id = text(customerId, "Customer id");
  const crmId = text(crmCustomerId, "CRM customer id");
  if (crmId.length > 64) throw new CustomerRecordError("CRM customer id is invalid.");
  const now = new Date().toISOString();
  const result = await customerDatabase().query(
    `UPDATE website_customers SET crm_customer_id = $1, updated_at = $2 WHERE id = $3`,
    [crmId, now, id],
  );
  if (result.rowCount !== 1) throw new CustomerRecordError("Customer could not be updated.");
}

export async function insertSession(input: {
  customerId: string;
  tokenHash: string;
  expiresAt: string;
}): Promise<SessionRecord> {
  const record: SessionRecord = {
    id: randomUUID(),
    customerId: text(input.customerId, "Customer id"),
    tokenHash: text(input.tokenHash, "Token hash"),
    expiresAt: text(input.expiresAt, "Expiry"),
    revokedAt: null,
    createdAt: new Date().toISOString(),
  };

  try {
    await customerDatabase().query(
      `INSERT INTO website_customer_sessions (id, customer_id, token_hash, expires_at, revoked_at, created_at)
       VALUES ($1, $2, $3, $4, NULL, $5)`,
      [record.id, record.customerId, record.tokenHash, record.expiresAt, record.createdAt],
    );
  } catch (error) {
    if (isUniqueConstraint(error, "website_customer_sessions_token_hash_key")) {
      throw new CustomerRecordError("A session with this token hash already exists.", "session-token-taken");
    }
    throw error;
  }

  return record;
}

export async function revokeSessionByTokenHash(tokenHash: string): Promise<void> {
  await customerDatabase().query(
    `UPDATE website_customer_sessions
     SET revoked_at = COALESCE(revoked_at, NOW())
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [text(tokenHash, "Token hash")],
  );
}

export async function deleteExpiredSessions(nowIso: string): Promise<void> {
  await customerDatabase().query(
    `DELETE FROM website_customer_sessions WHERE expires_at <= $1`,
    [text(nowIso, "Expiry")],
  );
}

export async function findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
  const result = await customerDatabase().query<SessionRow>(
    `SELECT id, customer_id, token_hash, expires_at, revoked_at, created_at
     FROM website_customer_sessions WHERE token_hash = $1`,
    [text(tokenHash, "Token hash")],
  );
  const row = result.rows[0];
  return row ? sessionFromRow(row) : null;
}
