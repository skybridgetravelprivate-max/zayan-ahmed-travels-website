import { resolve } from "path";
import { config as loadEnv } from "dotenv";

const cwd = process.cwd();
const files = [
  resolve(cwd, ".env"),
  resolve(cwd, "../../.env"),
  resolve(cwd, "packages/database/.env"),
  resolve(cwd, "../../packages/database/.env"),
  resolve(cwd, "packages/database/prisma/.env"),
  resolve(cwd, ".env.production"),
];
for (const file of files) {
  loadEnv({ path: file });
}
loadEnv();

const pg =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.DIRECT_URL;
if (pg && (!process.env.DATABASE_URL || /@HOST[:/]/i.test(process.env.DATABASE_URL))) {
  process.env.DATABASE_URL = pg;
}

function requireJwtSecret(name: string) {
  const v = String(process.env[name] || "");
  const weak = !v || v.length < 32 || /change-me|generate-/i.test(v);
  if (process.env.NODE_ENV === "production" && weak) {
    throw new Error(`${name} must be a random string of at least 32 characters`);
  }
}
requireJwtSecret("JWT_SECRET");
requireJwtSecret("JWT_REFRESH_SECRET");
