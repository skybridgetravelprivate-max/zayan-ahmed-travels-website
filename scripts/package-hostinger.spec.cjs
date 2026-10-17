"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { packageHostinger } = require("./package-hostinger.cjs");

test("standalone artifact boots combined launcher and excludes private runtime files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zat-package-"));
  const write = (file, value = "fixture") => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), value);
  };
  try {
    write(".next/standalone/server.js", "original Next launcher");
    write(".next/required-server-files.json", JSON.stringify({ config: { distDir: ".next" } }));
    write(".next/static/main.js");
    write("backend/apps/api/dist/create-app.js");
    write("backend/scripts/hostinger-start.cjs");
    write("backend/scripts/hostinger-api-path.cjs");
    write("backend/packages/config/postgres-tls.cjs");
    write("backend/packages/config/.env.local", "private fixture");
    write("backend/node_modules/example/index.js");
    write("backend/node_modules/example/.env", "private fixture");
    write("backend/node_modules/example/customer.sqlite", "private fixture");
    write("public/logo.svg");
    packageHostinger(root);
    const output = path.join(root, ".next/standalone");
    const launcher = fs.readFileSync(path.join(output, "server.js"), "utf8");
    assert.match(launcher, /HOSTINGER_WEB_DIR = __dirname/);
    assert.match(launcher, /require\("\.\/backend\/scripts\/hostinger-start.cjs"\)/);
    assert.match(launcher, /__NEXT_PRIVATE_STANDALONE_CONFIG/);
    for (const file of ["backend/apps/api/dist/create-app.js", "backend/node_modules/example/index.js", ".next/static/main.js", "public/logo.svg"]) {
      assert.ok(fs.existsSync(path.join(output, file)), file);
    }
    for (const file of ["backend/packages/config/.env.local", "backend/node_modules/example/.env", "backend/node_modules/example/customer.sqlite"]) {
      assert.equal(fs.existsSync(path.join(output, file)), false, file);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
