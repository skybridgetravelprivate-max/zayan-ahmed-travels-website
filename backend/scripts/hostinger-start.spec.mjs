import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const secretMarker = "FIXTURE_SECRET_DO_NOT_LOG";

test("gateway waits for website readiness before accepting requests", async () => {
  let handleRequest;
  let release;
  const prepared = new Promise(resolve => { release = resolve; });
  const server = { on() {}, listen() {} };
  const dependencies = {
    http: { createServer(handler) { handleRequest = handler; return server; } },
    fs: { existsSync: () => false },
    path,
    url: { parse: () => ({}) },
    "./hostinger-api-path.cjs": (await import("./hostinger-api-path.cjs")).default,
    next: () => ({ prepare: () => prepared, getRequestHandler: () => (_req, res) => { res.writeHead(200, {}); res.end("ready"); } }),
  };
  const context = { require(name) { assert.ok(name in dependencies); return dependencies[name]; }, __dirname: scriptsDir, process: { env: { START_MODE: "web" } }, console: { log() {}, error() {} }, URL };
  const startup = vm.runInNewContext(readFileSync(path.join(scriptsDir, "hostinger-start.cjs"), "utf8"), context);
  assert.equal(handleRequest, undefined, "cold requests must wait for initialization rather than get a startup 503");
  release();
  await startup;
  let status, headers, body;
  const response = { writeHead(code, values) { status = code; headers = values; }, end(value) { body = value; } };
  handleRequest({ url: "/admin" }, response);
  assert.equal(status, 200);
  assert.equal(body, "ready");
  // In web-only mode the unavailable API fallback must remain uncached.
  handleRequest({ url: "/api/auth/me" }, response);
  assert.equal(status, 503);
  assert.equal(headers["cache-control"], "no-store");
  assert.equal(headers["retry-after"], "3");
  context.process.env.RECEIPT_WRITES_DISABLED = "true";
  handleRequest({ method: "POST", url: "/api/v1/finance/receipts?retry=1" }, response);
  assert.equal(status, 503);
  assert.equal(headers["cache-control"], "private, no-store");
  assert.equal(headers["retry-after"], "60");
  assert.match(body, /Preserve the original retry key/);
  handleRequest({ method: "POST", url: "/api/v1/finance/receipts/request_test/review" }, response);
  assert.equal(headers["retry-after"], "60");
  handleRequest({ method: "GET", url: "/admin" }, response);
  assert.equal(status, 200);
});

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
