import type { PoolConfig } from "pg";
export function createPostgresConnectionConfig(connectionString: string, caCertificate?: string): PoolConfig;
