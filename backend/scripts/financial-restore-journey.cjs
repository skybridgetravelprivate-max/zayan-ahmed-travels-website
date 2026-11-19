"use strict";

// Explicitly opt-in. Never accepts a remote or production database.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { randomUUID, createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { PrismaClient, Prisma } = require("../node_modules/@prisma/client");
const root = path.resolve(__dirname, "../..");
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

function checkedTarget(value, pattern) {
  const target = new URL(value);
  assert.equal(target.protocol, "postgresql:");
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.port, "55463");
  assert.match(target.pathname, pattern);
  assert.equal(target.search, "");
  return target;
}

async function fingerprint(db) {
  const rows = {};
  for (const model of ["receipt", "ticketSale", "umrahBooking", "hotelBooking", "transportBooking", "starBooking"]) {
    rows[model] = await db[model].findMany({ orderBy: { id: "asc" } });
  }
  rows.journals = await db.journalEntry.findMany({
    orderBy: { id: "asc" }, include: { lines: { orderBy: { id: "asc" } } },
  });
  assert.ok(rows.receipt.length > 0 && rows.journals.length > 0, "Seed the payment integration fixtures first");
  let debit = new Prisma.Decimal(0), credit = new Prisma.Decimal(0);
  for (const journal of rows.journals) {
    const sum = field => journal.lines.reduce((total, line) => total.plus(line[field]), new Prisma.Decimal(0));
    assert.ok(sum("debit").equals(sum("credit")), "Unbalanced fixture journal");
    debit = debit.plus(sum("debit")); credit = credit.plus(sum("credit"));
  }
  const journalIds = new Set(rows.journals.map(journal => journal.id));
  for (const receipt of rows.receipt) {
    assert.ok(receipt.journalId && journalIds.has(receipt.journalId), "Receipt journal was not recovered");
  }
  return {
    sha256: digest(JSON.stringify(rows)),
    journals: rows.journals.length, receipts: rows.receipt.length,
    debit: debit.toFixed(2), credit: credit.toFixed(2),
  };
}

async function main() {
  const source = checkedTarget(process.env.ZAT_SYNTHETIC_DATABASE_URL, /^\/zat_synthetic_payment_integration$/);
  const target = checkedTarget(process.env.ZAT_RESTORE_DATABASE_URL, /^\/zat_restore_financial_[a-z0-9_]+$/);
  assert.equal(source.username, target.username);
  assert.equal(source.password, target.password);
  const required = name => { assert.ok(process.env[name], `Set ${name}`); return process.env[name]; };
  const bin = required("ZAT_PG_BIN"), age = required("ZAT_AGE_BIN");
  const identity = required("ZAT_RECOVERY_IDENTITY"), recipient = required("ZAT_RECOVERY_RECIPIENT");
  const output = path.resolve(required("ZAT_FINANCIAL_RESTORE_OUTPUT"));
  // A fresh output directory and fresh destination database prevent accidental replacement.
  await fs.mkdir(output, { recursive: false });
  const pgEnv = {
    ...process.env, PGHOST: "127.0.0.1", PGPORT: "55463",
    PGUSER: decodeURIComponent(source.username), PGPASSWORD: decodeURIComponent(source.password),
    PGOPTIONS: "-c timezone=UTC", PGDATABASE: source.pathname.slice(1),
  };
  const run = (exe, args, env = pgEnv) => execFileSync(exe, args, { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  const pg = (name, args) => run(path.join(bin, name + (process.platform === "win32" ? ".exe" : "")), args);
  const original = new PrismaClient({ datasourceUrl: source.toString() });
  const restored = new PrismaClient({ datasourceUrl: target.toString() });
  try {
    const [server] = await original.$queryRaw`SELECT current_setting('server_version_num')::int AS version, current_setting('timezone') AS timezone`;
    assert.ok(server.version >= 170000 && server.version < 180000);
    assert.equal(server.timezone.toUpperCase(), "UTC");
    const before = await fingerprint(original);
    const tag = "synthetic-" + randomUUID();
    const branch = await original.branch.create({ data: { id: tag, code: tag, name: "Synthetic restore branch" } });
    const staff = await original.user.create({ data: { id: tag, username: tag, email: tag + "@example.test", fullName: "Synthetic restore staff", passwordHash: "invalid", defaultBranchId: branch.id } });
    const customer = await original.customer.create({ data: { id: tag, customerNumber: tag, fullName: "Synthetic restore owner", branchId: branch.id } });
    const bytes = Buffer.from("%PDF-1.7\nSynthetic financial recovery object. No customer data.\n");
    const document = await original.storedDocument.create({ data: {
      id: tag, fileName: "synthetic.pdf", mimeType: "application/pdf", sizeBytes: bytes.length,
      storageKey: `synthetic/${tag}.pdf`, entityType: "customer", entityId: customer.id, uploadedById: staff.id,
    } });
    const sourceObjects = path.join(output, "source-objects");
    await fs.mkdir(path.join(sourceObjects, "synthetic"), { recursive: true });
    await fs.writeFile(path.join(sourceObjects, document.storageKey), bytes, { flag: "wx" });
    const fixturePath = path.join(output, "fixture.json");
    await fs.writeFile(fixturePath, JSON.stringify({ format: "zat-synthetic-document-fixture", version: 1, documents: [{ ...document, createdAt: document.createdAt.toISOString(), synthetic: true }] }));
    const { exportBackup, restoreBackup, reconcileFixture } = await import(pathToFileURL(path.join(__dirname, "document-backup.mjs")));
    const packageRoot = path.join(output, "package");
    await fs.mkdir(packageRoot);
    await exportBackup({ metadataPath: fixturePath, objectsPath: sourceObjects, destination: path.join(packageRoot, "documents") });
    const dump = path.join(packageRoot, "database.dump");
    pg("pg_dump", ["--format=custom", "--schema=public", "--no-owner", "--no-acl", "--file", dump]);
    const archive = path.join(output, "financial-recovery.tar");
    run("tar", ["-cf", archive, "-C", packageRoot, "database.dump", "documents"]);
    const encrypted = archive + ".age", decrypted = path.join(output, "decrypted.tar");
    run(age, ["--encrypt", "--recipient", recipient.trim(), "--output", encrypted, archive]);
    const encryptedHash = digest(await fs.readFile(encrypted));
    run(age, ["--decrypt", "--identity", identity, "--output", decrypted, encrypted]);
    assert.equal(digest(await fs.readFile(decrypted)), digest(await fs.readFile(archive)));
    const extracted = path.join(output, "extracted");
    await fs.mkdir(extracted);
    run("tar", ["-xf", decrypted, "-C", extracted]);
    pg("createdb", [target.pathname.slice(1)]);
    pg("pg_restore", ["--dbname", target.pathname.slice(1), "--clean", "--if-exists", "--no-owner", "--no-acl", "--exit-on-error", "--single-transaction", path.join(extracted, "database.dump")]);
    const sql = path.join(output, "source-data.sql");
    pg("pg_restore", ["--data-only", "--file", sql, dump]);
    const baseline = JSON.parse(run(process.execPath, [path.join(__dirname, "verify-restored-public.cjs")], {
      ...pgEnv, ZAT_RESTORE_DATABASE_URL: target.toString(), ZAT_RESTORE_SOURCE_SQL: sql,
      ZAT_RESTORE_EVIDENCE_PATH: "",
    }).toString());
    assert.deepEqual(await fingerprint(restored), before);
    const restoredObjects = path.join(output, "restored-documents");
    await restoreBackup({ backupPath: path.join(extracted, "documents"), destination: restoredObjects });
    assert.deepEqual(await reconcileFixture({ metadataPath: path.join(restoredObjects, "metadata.json"), objectsPath: path.join(restoredObjects, "objects") }), { metadataCount: 1, objectCount: 1, missingCount: 0, orphanCount: 0 });
    const recoveredDocument = await restored.storedDocument.findUniqueOrThrow({ where: { id: document.id } });
    assert.deepEqual(recoveredDocument, document);
    const storagePath = path.join(restoredObjects, "objects");
    process.env.NODE_ENV = "test"; process.env.STORAGE_DRIVER = "local"; process.env.LOCAL_STORAGE_PATH = storagePath;
    const { StorageService } = require("../apps/api/dist/common/storage.service.js");
    const { AuditService } = require("../apps/api/dist/common/audit.service.js");
    const { DocumentsController } = require("../apps/api/dist/documents/documents.controller.js");
    const controller = new DocumentsController(restored, new StorageService(), new AuditService(restored));
    const actor = { id: staff.id, isSuperAdmin: true, branchIds: [branch.id], defaultBranchId: branch.id };
    const headers = {}; let downloaded;
    await controller.download(document.id, { setHeader: (key, value) => { headers[key] = value; }, send: value => { downloaded = value; } }, { user: actor });
    assert.equal(digest(downloaded), digest(bytes));
    assert.equal(headers["Cache-Control"], "private, no-store");
    await assert.rejects(controller.download(document.id, {}, { user: { ...actor, isSuperAdmin: false, branchIds: [], defaultBranchId: null, permissions: ["document.view", "customer.view"] } }), { status: 404 });
    const restartedHash = run(process.execPath, ["-e", "const {StorageService}=require(process.argv[1]);new StorageService().get(process.argv[2]).then(b=>console.log(require('node:crypto').createHash('sha256').update(b).digest('hex'))).catch(()=>process.exitCode=1)", path.join(root, "backend/apps/api/dist/common/storage.service.js"), document.storageKey], process.env).toString().trim();
    assert.equal(restartedHash, digest(bytes));
    const result = { status: "passed", syntheticOnly: true, encryptedSHA256: encryptedHash, ...baseline, financial: before, documents: { restored: 1, missing: 0, orphan: 0, authorizedRead: true, foreignBranchDenied: true, freshProcessHashMatched: true }, limits: ["Local PostgreSQL/public schema and local object adapter only", "No offsite retrieval, independent key custody or hosted runtime-role/RLS acceptance"] };
    await fs.writeFile(path.join(output, "result.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await original.$disconnect(); await restored.$disconnect();
  }
}

main().catch(error => { console.error("Synthetic financial restore failed:", error.name); process.exitCode = 1; });
