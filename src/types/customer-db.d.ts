declare module "server-only";

declare module "node:sqlite" {
  type SqlValue = string | number | bigint | null | Uint8Array;

  interface StatementSync {
    get(...params: SqlValue[]): Record<string, SqlValue> | undefined;
    run(...params: SqlValue[]): { changes: number | bigint };
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
