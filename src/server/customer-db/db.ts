import "server-only";

import { Pool } from "pg";
import { createPostgresConnectionConfig } from "../../../backend/packages/config/postgres-tls.cjs";

export class CustomerDatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not configured for website customer storage.");
  }
}

let pool: Pool | null = null;

function databaseUrl() {
  const configured =
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    "";
  if (!configured) throw new CustomerDatabaseNotConfiguredError();
  return configured;
}

/** Creates a server-only PostgreSQL pool with verified TLS for remote hosts. */
export function customerDatabase() {
  if (pool) return pool;

  const config = createPostgresConnectionConfig(databaseUrl());
  pool = new Pool({
    ...config,
    max: 5,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
  });
  return pool;
}
