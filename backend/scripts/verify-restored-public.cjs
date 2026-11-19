const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const repository = path.resolve(__dirname, "../..");
const { Client } = require(path.join(repository, "backend/node_modules/pg"));
const { PrismaClient } = require(path.join(repository, "backend/node_modules/@prisma/client"));
const connectionString = process.env.ZAT_RESTORE_DATABASE_URL;
const target = new URL(connectionString);
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname), "Restore verification requires loopback");
assert.match(target.pathname, /^\/zat_restore_[a-z0-9_]+$/, "Use a dedicated restore database");
const sourceSql = process.env.ZAT_RESTORE_SOURCE_SQL;
assert.ok(sourceSql, "Set ZAT_RESTORE_SOURCE_SQL to the private pg_restore data-only output");
const quote = value => '"' + value.replaceAll('"', '""') + '"';
const expected = new Map();
let copying = null;
for (const line of fs.readFileSync(sourceSql, "utf8").split(/\r?\n/)) {
  const match = line.match(/^COPY public\.("(?:[^"]|"")*"|[A-Za-z_]\w*) \(/);
  if (match) {
    copying = match[1].replace(/^"|"$/g, "").replaceAll('""', '"');
    expected.set(copying, 0);
  } else if (line === "\\.") {
    copying = null;
  } else if (copying !== null) {
    expected.set(copying, expected.get(copying) + 1);
  }
}
async function main() {
  const db = new Client({ connectionString });
  const prisma = new PrismaClient({ datasourceUrl: connectionString });
  await db.connect();
  try {
    await db.query("BEGIN READ ONLY");
    const version = (await db.query("show server_version")).rows[0].server_version;
    assert.match(version, /^17\./, "Use PostgreSQL 17 for this recovery exercise");
    const tables = await db.query("select tablename from pg_tables where schemaname='public'");
    assert.equal(tables.rows.length, expected.size);
    assert.ok(expected.size > 0, "Archive contains no public COPY records");
    let totalRows = 0;
    const representativeCounts = {};
    for (const [table, count] of expected) {
      const result = await db.query("select count(*)::int as count from public." + quote(table));
      assert.equal(result.rows[0].count, count, "Archive row count mismatch for " + table);
      totalRows += count;
      if (["User", "Customer", "Booking", "Document", "JournalEntry", "website_customers", "_prisma_migrations"].includes(table)) {
        representativeCounts[table] = count;
      }
    }
    const constraints = await db.query([
      "select c.conrelid::regclass::text as source, c.confrelid::regclass::text as target,",
      "c.convalidated as validated,",
      "array(select a.attname from unnest(c.conkey) with ordinality k(num,ord)",
      "join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.num",
      "order by k.ord)::text[] as source_keys,",
      "array(select a.attname from unnest(c.confkey) with ordinality k(num,ord)",
      "join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.num",
      "order by k.ord)::text[] as target_keys",
      "from pg_constraint c join pg_namespace n on n.oid=c.connamespace",
      "where c.contype='f' and n.nspname='public'",
    ].join(" "));
    for (const constraint of constraints.rows) {
      assert.equal(constraint.validated, true);
      const present = constraint.source_keys.map(key => "s." + quote(key) + " IS NOT NULL").join(" AND ");
      const matching = constraint.source_keys.map((key, index) => "s." + quote(key) + "=t." + quote(constraint.target_keys[index])).join(" AND ");
      const orphans = await db.query("SELECT count(*)::int AS count FROM " + constraint.source + " s WHERE " + present + " AND NOT EXISTS (SELECT 1 FROM " + constraint.target + " t WHERE " + matching + ")");
      assert.equal(orphans.rows[0].count, 0);
    }
    const migrations = await db.query("select migration_name,finished_at is not null as finished,rolled_back_at from _prisma_migrations order by migration_name");
    assert.ok(migrations.rows.length > 0);
    assert.ok(migrations.rows.every(row => row.finished && row.rolled_back_at === null));
    const applicationReads = {};
    for (const model of ["user", "customer", "umrahBooking", "storedDocument", "journalEntry", "websiteCustomer", "cmsPage"]) {
      applicationReads[model] = await prisma[model].count();
    }
    await db.query("COMMIT");
    const evidence = {
      PostgreSQL: version,
      tablesMatched: expected.size, totalRows, representativeCounts,
      foreignKeysValidated: constraints.rows.length, orphanRows: 0,
      completedMigrations: migrations.rows.length, applicationReads,
    };
    if (process.env.ZAT_RESTORE_EVIDENCE_PATH) fs.writeFileSync(process.env.ZAT_RESTORE_EVIDENCE_PATH, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    await prisma.$disconnect();
    await db.end();
  }
}
main().catch(error => {
  console.error("Restore verification failed", error.name);
  process.exitCode = 1;
});
