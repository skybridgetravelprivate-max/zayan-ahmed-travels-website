export interface PostgresConnectionConfig {
  connectionString: string;
  ssl:
    | {
        rejectUnauthorized: true;
        ca?: string;
      }
    | undefined;
}

export function createPostgresConnectionConfig(
  connectionString: string,
  caCertificate?: string,
): PostgresConnectionConfig;
