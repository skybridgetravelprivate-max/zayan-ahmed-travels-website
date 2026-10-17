import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const secretMarker = "FIXTURE_SECRET_DO_NOT_LOG";

for (const mode of ["api", "all"]) {
  test(`missing API artifact fails startup in ${mode} mode`, () => {
    const fixtureRoot = mkdtempSync(path.join(tmpdir(), "hostinger-start-"));
    const fixtureScripts = path.join(fixtureRoot, "backend", "scripts");
    mkdirSync(fixtureScripts, { recursive: true });
    cpSync(path.join(scriptsDir, "hostinger-start.cjs"), path.join(fixtureScripts, "hostinger-start.cjs"));
    cpSync(path.join(scriptsDir, "hostinger-api-path.cjs"), path.join(fixtureScripts, "hostinger-api-path.cjs"));

    try {
      const result = spawnSync(process.execPath, [path.join(fixtureScripts, "hostinger-start.cjs")], {
        encoding: "utf8",
        env: {
          ...process.env,
          DATABASE_URL: secretMarker,
          JWT_SECRET: secretMarker,
          START_MODE: mode,
          PORT: "0",
        },
        timeout: 5000,
      });
      const output = `${result.stdout || ""}${result.stderr || ""}`;

      assert.equal(result.error, undefined);
      assert.equal(result.status, 1);
      assert.match(output, /Hostinger startup failed: Required API build artifact is missing: apps\/api\/dist\/create-app\.js/);
      assert.ok(!output.includes(secretMarker), "startup output must not include environment values");
      for (const relativePath of [
        "backend/apps/api/.env",
        "backend/packages/database/.env",
        "backend/packages/database/prisma/.env",
      ]) {
        assert.equal(existsSync(path.join(fixtureRoot, relativePath)), false, `${relativePath} must not be created`);
      }
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
}
