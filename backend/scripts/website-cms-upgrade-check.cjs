"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Client } = require("../node_modules/pg");
async function main() {
  const target = new URL(process.env.ZAT_SYNTHETIC_DATABASE_URL);
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.port, "55463");
  assert.equal(target.pathname, "/zat_synthetic_cms_upgrade_20261028");
  const root = path.resolve(__dirname, "../..");
  const old = path.resolve(process.env.ZAT_CMS_BASELINE_SCHEMA || "");
  assert.equal(path.basename(old), "schema.prisma");
  assert.ok(old.includes("manual-workflows-20261024"));
  const environment = {};
  for (const k of [
    "SystemRoot",
    "WINDIR",
    "TEMP",
    "TMP",
    "PATH",
    "USERPROFILE",
    "LOCALAPPDATA",
  ])
    if (process.env[k]) environment[k] = process.env[k];
  environment.DATABASE_URL = target.href;
  function migrate(schema) {
    const r = spawnSync(
      process.execPath,
      [
        path.join(root, "backend/node_modules/prisma/build/index.js"),
        "migrate",
        "deploy",
        "--schema",
        schema,
      ],
      { cwd: root, env: environment, encoding: "utf8", windowsHide: true },
    );
    assert.equal(r.status, 0, "Synthetic migration failed");
  }
  migrate(old);
  const db = new Client({ connectionString: target.href });
  await db.connect();
  try {
    assert.equal(
      Number(
        (
          await db.query(
            'SELECT count(*) n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
          )
        ).rows[0].n,
      ),
      13,
    );
    await db.query(
      'INSERT INTO "CmsPage"(id,slug,title,body,status,"updatedAt") VALUES($1,$2,$3,$4,$5,now())',
      [
        "synthetic-legacy-published",
        "legacy-published",
        "Synthetic legacy title",
        "Preserve <literal> body exactly.",
        "PUBLISHED",
      ],
    );
    await db.query(
      'INSERT INTO "CmsPage"(id,slug,title,body,status,"updatedAt") VALUES($1,$2,$3,$4,$5,now())',
      [
        "synthetic-legacy-draft",
        "legacy-draft",
        "Synthetic private draft",
        "Never publish this draft.",
        "DRAFT",
      ],
    );
    migrate(path.join(root, "backend/packages/database/prisma/schema.prisma"));
    const rows = (
      await db.query(
        'SELECT slug,title,body,status,draft,published,"publishedVersion" FROM "CmsPage" ORDER BY slug',
      )
    ).rows;
    const published = rows.find((r) => r.slug === "legacy-published"),
      draft = rows.find((r) => r.slug === "legacy-draft");
    assert.equal(published.body, "Preserve <literal> body exactly.");
    assert.equal(published.published.body, published.body);
    assert.equal(published.publishedVersion, 0);
    assert.equal(draft.published, null);
    assert.equal(draft.draft.body, "Never publish this draft.");
    assert.equal(
      Number(
        (
          await db.query(
            "SELECT count(*) n FROM \"CmsPageRevision\" WHERE version=0 AND action='IMPORT'",
          )
        ).rows[0].n,
      ),
      2,
    );
    const tables = (
      await db.query(
        "SELECT relname,relrowsecurity FROM pg_class WHERE relname IN ('CmsPage','CmsPageRevision')",
      )
    ).rows;
    assert.ok(tables.every((t) => t.relrowsecurity));
    assert.equal(
      Number(
        (
          await db.query(
            'SELECT count(*) n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
          )
        ).rows[0].n,
      ),
      14,
    );
    console.log(
      JSON.stringify({
        status: "passed",
        syntheticOnly: true,
        baselineMigrations: 13,
        candidateMigrations: 14,
        checks: [
          "legacy publication body preserved byte-for-byte as text",
          "legacy draft remains private",
          "revision zero retained for both rows",
          "editorial RLS enabled",
          "no production migration",
        ],
      }),
    );
  } finally {
    await db.end();
  }
}
main().catch(() => {
  console.error("Synthetic CMS upgrade check failed; no production access.");
  process.exitCode = 1;
});
