import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testFiles = [
  "apps/api/src/website/website-inquiries.controller.spec.ts",
  "apps/api/src/website/website-customer-upsert.service.spec.ts",
  "apps/api/src/website/website-internal-token.spec.ts",
  "apps/api/src/website/website-booking.dto.spec.ts",
  "apps/api/src/reservation/reservation.dates.spec.ts",
  "apps/api/src/common/storage.service.spec.ts",
  "apps/api/src/auth/first-admin-setup.service.spec.ts",
  "packages/config/postgres-tls.spec.cjs",
  "scripts/hostinger-api-path.spec.mjs",
  "scripts/hostinger-start.spec.mjs",
];

const env = {
  PATH: process.env.PATH,
  SystemRoot: process.env.SystemRoot,
  TEMP: process.env.TEMP,
  TMP: process.env.TMP,
  NODE_ENV: "test",
  TSX_TSCONFIG_PATH: path.join(backendRoot, "apps", "api", "tsconfig.json"),
};

const result = spawnSync(
  process.execPath,
  ["--conditions=react-server", "--import", "tsx", "--test", ...testFiles],
  { cwd: backendRoot, env, stdio: "inherit" },
);

if (result.error) {
  console.error("Could not start the backend test runner:", result.error.message);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
