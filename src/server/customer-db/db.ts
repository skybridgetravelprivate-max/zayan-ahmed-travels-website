import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export class CustomerDatabaseNotConfiguredError extends Error {
  constructor() {
    super("Customer database is not configured.");
  }
}

const schema = `
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS customers_email_unique ON customers (email);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_hash_unique ON sessions (token_hash);
CREATE INDEX IF NOT EXISTS sessions_customer_id_index ON sessions (customer_id);
`;

let database: DatabaseSync | null = null;

function databasePath() {
  const configured = process.env.CUSTOMER_DATABASE_PATH?.trim() ?? "";
  if (!configured || /^[a-z][a-z0-9+.-]*:\/\//i.test(configured)) {
    throw new CustomerDatabaseNotConfiguredError();
  }
  return path.resolve(/*turbopackIgnore: true*/ configured);
}

/** Opens the local customer database. CRM settings are not read. */
export function customerDatabase() {
  if (database) return database;

  const filePath = databasePath();
  mkdirSync(path.dirname(filePath), { recursive: true });
  const opened = new DatabaseSync(filePath);
  opened.exec("PRAGMA foreign_keys = ON");
  opened.exec(schema);
  database = opened;
  return opened;
}
