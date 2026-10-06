import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function databaseUrl() {
  const raw =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    "";
  const url = raw.trim().replace(/^["']|["']$/g, "");
  if (url && process.env.DATABASE_URL !== url) process.env.DATABASE_URL = url;
  return url;
}

export function databaseUrlProblem() {
  const url = databaseUrl();
  if (!url) return "DATABASE_URL is empty.";
  if (/mysql:\/\//i.test(url)) return "DATABASE_URL is MySQL. This app needs PostgreSQL (Neon or Supabase).";
  if (/@HOST[:/]/i.test(url) || /@USER:PASSWORD@/i.test(url)) {
    return "DATABASE_URL still uses the example host HOST. Replace it with the real hostname from Neon/Supabase (for example ep-xxxx.aws.neon.tech).";
  }
  return null;
}

function needsSsl(url: string) {
  if (!url) return false;
  if (/localhost|127\.0\.0\.1/i.test(url)) return false;
  return true;
}

function prismaOptions() {
  const url = databaseUrl();
  if (!url) return {};
  const pool = new Pool({
    connectionString: url,
    max: 5,
    connectionTimeoutMillis: 15000,
    ssl: needsSsl(url) ? { rejectUnauthorized: false } : undefined,
  });
  return { adapter: new PrismaPg(pool) };
}

export function sanitizeDbError(err: unknown) {
  const e = err as { code?: string; message?: string };
  let msg = String(e?.message ?? err ?? "unknown");
  msg = msg.replace(/postgresql:\/\/[^@\s]+@/gi, "postgresql://***@");
  msg = msg.replace(/:[^:@/]+@/g, ":***@");
  if (msg.length > 240) msg = msg.slice(0, 240);
  return e?.code ? `${e.code}: ${msg}` : msg;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super(prismaOptions());
  }

  async onModuleInit() {
    const problem = databaseUrlProblem();
    if (problem) {
      console.error(problem);
      return;
    }
    try {
      await this.$connect();
    } catch (err) {
      console.error("Prisma failed to connect:", sanitizeDbError(err));
    }
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }

  async ping() {
    const problem = databaseUrlProblem();
    if (problem) throw new Error(problem);
    await this.$queryRawUnsafe("SELECT 1");
    return true;
  }
}
