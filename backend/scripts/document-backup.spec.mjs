import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  exportBackup,
  atomicDirectory,
  reconcileFixture,
  restoreBackup,
  verifyBackup,
} from "./document-backup.mjs";

const pdf = Buffer.from("%PDF-1.7\nsynthetic fixture only\n");

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "zat-document-backup-test-"));
  const source = path.join(root, "source");
  const output = path.join(root, "outputs");
  await mkdir(path.join(source, "synthetic"), { recursive: true });
  await mkdir(output);
  await writeFile(path.join(source, "synthetic", "sample.pdf"), pdf);
  const metadata = {
    format: "zat-synthetic-document-fixture",
    version: 1,
    documents: [{
      id: "synthetic-document-1",
      fileName: "sample.pdf",
      mimeType: "application/pdf",
      sizeBytes: pdf.length,
      storageKey: "synthetic/sample.pdf",
      entityType: "lead",
      entityId: "synthetic-lead-1",
      status: "UPLOADED",
      uploadedById: "synthetic-staff-1",
      createdAt: "2026-10-18T00:00:00.000Z",
      synthetic: true,
    }],
  };
  const metadataPath = path.join(root, "metadata.json");
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  return { root, source, output, metadata, metadataPath };
}

test("synthetic export verifies and restores metadata plus exact object bytes", async (t) => {
  const data = await fixture();
  t.after(() => rm(data.root, { recursive: true, force: true }));
  const backup = path.join(data.output, "backup");
  const restored = path.join(data.output, "restored");

  assert.deepEqual(
    await exportBackup({
      metadataPath: data.metadataPath,
      objectsPath: data.source,
      destination: backup,
    }),
    { documentCount: 1, totalBytes: pdf.length },
  );
  assert.deepEqual(await verifyBackup(backup), { documentCount: 1, totalBytes: pdf.length });
  await assert.rejects(
    exportBackup({
      metadataPath: data.metadataPath,
      objectsPath: data.source,
      destination: backup,
    }),
    /already exists/,
  );
  const manifest = JSON.parse(await readFile(path.join(backup, "manifest.json"), "utf8"));
  assert.equal(
    manifest.documents[0].sha256,
    createHash("sha256").update(pdf).digest("hex"),
  );
  assert.deepEqual(
    await restoreBackup({ backupPath: backup, destination: restored }),
    { documentCount: 1, totalBytes: pdf.length },
  );
  assert.deepEqual(
    JSON.parse(await readFile(path.join(restored, "metadata.json"), "utf8")),
    data.metadata,
  );
  const restoredBytes = await readFile(
    path.join(restored, "objects", "synthetic", "sample.pdf"),
  );
  assert.deepEqual(restoredBytes, pdf);
  assert.equal(
    await readFile(path.join(restored, "manifest.json"), "utf8"),
    await readFile(path.join(backup, "manifest.json"), "utf8"),
  );
  await assert.rejects(
    restoreBackup({ backupPath: backup, destination: restored }),
    /already exists/,
  );
});

test("manifest checksum detects modified metadata and object bytes", async (t) => {
  const data = await fixture();
  t.after(() => rm(data.root, { recursive: true, force: true }));
  const backup = path.join(data.output, "backup");
  await exportBackup({
    metadataPath: data.metadataPath,
    objectsPath: data.source,
    destination: backup,
  });

  const metadataPath = path.join(backup, "metadata.json");
  const originalMetadata = await readFile(metadataPath);
  await writeFile(metadataPath, Buffer.concat([originalMetadata, Buffer.from(" ")]));
  await assert.rejects(verifyBackup(backup), /manifest does not match its metadata/);
  await writeFile(metadataPath, originalMetadata);

  const objectPath = path.join(backup, "objects", "synthetic", "sample.pdf");
  await writeFile(objectPath, Buffer.from("%PDF-1.7\nchanged\n"));
  await assert.rejects(verifyBackup(backup), /failed size, checksum, or content validation/);
});

test("verification rejects a malformed or modified manifest", async (t) => {
  const data = await fixture();
  t.after(() => rm(data.root, { recursive: true, force: true }));
  const backup = path.join(data.output, "backup");
  await exportBackup({
    metadataPath: data.metadataPath,
    objectsPath: data.source,
    destination: backup,
  });

  const manifestPath = path.join(backup, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.documents[0].sha256 = "0".repeat(64);
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(verifyBackup(backup), /failed size, checksum, or content validation/);
  await writeFile(manifestPath, "{");
  await assert.rejects(verifyBackup(backup), /not valid JSON/);
});

test("manifest validation rejects unknown fields and duplicate document identifiers", async (t) => {
  const data = await fixture();
  t.after(() => rm(data.root, { recursive: true, force: true }));
  const backup = path.join(data.output, "backup");
  await exportBackup({
    metadataPath: data.metadataPath,
    objectsPath: data.source,
    destination: backup,
  });

  const manifestPath = path.join(backup, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.unexpected = true;
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(verifyBackup(backup), /manifest does not match its metadata/);
  delete manifest.unexpected;
  manifest.documents.push({ ...manifest.documents[0], storageKey: "synthetic/other.pdf" });
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(verifyBackup(backup), /invalid object record/);
});

test("verification rejects missing and unexpected object files", async (t) => {
  const data = await fixture();
  t.after(() => rm(data.root, { recursive: true, force: true }));
  const backup = path.join(data.output, "backup");
  await exportBackup({
    metadataPath: data.metadataPath,
    objectsPath: data.source,
    destination: backup,
  });

  await rm(path.join(backup, "objects", "synthetic", "sample.pdf"));
  await assert.rejects(verifyBackup(backup), /missing one or more expected object files/);
  await writeFile(path.join(backup, "objects", "synthetic", "sample.pdf"), pdf);
  await writeFile(path.join(backup, "objects", "synthetic", "orphan.pdf"), pdf);
  await assert.rejects(verifyBackup(backup), /unexpected or orphan files/);
});

test("input, output-parent, and backup object symlinks cannot escape their roots", async (t) => {
  const data = await fixture();
  t.after(() => rm(data.root, { recursive: true, force: true }));
  const linkType = process.platform === "win32" ? "junction" : "dir";
  const sourceAlias = path.join(data.root, "source-alias");
  await symlink(data.source, sourceAlias, linkType);
  await assert.rejects(
    exportBackup({
      metadataPath: data.metadataPath,
      objectsPath: sourceAlias,
      destination: path.join(data.output, "source-link-backup"),
    }),
    /non-symlink directory/,
  );

  const outputAlias = path.join(data.root, "output-alias");
  await symlink(data.output, outputAlias, linkType);
  await assert.rejects(
    exportBackup({
      metadataPath: data.metadataPath,
      objectsPath: data.source,
      destination: path.join(outputAlias, "outside"),
    }),
    /non-symlink directory/,
  );

  const backup = path.join(data.output, "backup");
  await exportBackup({
    metadataPath: data.metadataPath,
    objectsPath: data.source,
    destination: backup,
  });
  const objectDirectory = path.join(backup, "objects", "synthetic");
  await rm(objectDirectory, { recursive: true });
  await symlink(data.source, objectDirectory, linkType);
  await assert.rejects(verifyBackup(backup), /Symbolic links are not accepted/);
  await rm(objectDirectory);
  await mkdir(objectDirectory);
  await writeFile(path.join(objectDirectory, "sample.pdf"), pdf);
  assert.equal((await verifyBackup(backup)).documentCount, 1);
});

test("export accepts only marked synthetic records and valid source bytes", async (t) => {
  const data = await fixture();
  t.after(() => rm(data.root, { recursive: true, force: true }));

  const productionLike = structuredClone(data.metadata);
  productionLike.documents[0].synthetic = false;
  await writeFile(data.metadataPath, JSON.stringify(productionLike));
  await assert.rejects(
    exportBackup({
      metadataPath: data.metadataPath,
      objectsPath: data.source,
      destination: path.join(data.output, "rejected"),
    }),
    /non-synthetic/,
  );
  assert.deepEqual(await readdir(data.output), []);

  await writeFile(data.metadataPath, JSON.stringify(data.metadata));
  await writeFile(path.join(data.source, "synthetic", "sample.pdf"), Buffer.from("not a PDF"));
  await assert.rejects(
    exportBackup({
      metadataPath: data.metadataPath,
      objectsPath: data.source,
      destination: path.join(data.output, "invalid-content"),
    }),
    /content type/,
  );
  assert.deepEqual(await readdir(data.output), []);
});

test("failed export removes staging output and does not publish a partial backup", async (t) => {
  const data = await fixture();
  t.after(() => rm(data.root, { recursive: true, force: true }));
  await rm(path.join(data.source, "synthetic", "sample.pdf"));
  await assert.rejects(
    exportBackup({
      metadataPath: data.metadataPath,
      objectsPath: data.source,
      destination: path.join(data.output, "failed-backup"),
    }),
    /fixture object is missing/,
  );
  assert.deepEqual(await readdir(data.output), []);
});

test("failed staged writes remove temporary output and never replace an existing destination", async (t) => {
  const data = await fixture();
  t.after(() => rm(data.root, { recursive: true, force: true }));
  const destination = path.join(data.output, "interrupted");
  await assert.rejects(
    atomicDirectory(destination, async (stage) => {
      await writeFile(path.join(stage, "partial"), "synthetic partial");
      throw new Error("simulated interrupted write");
    }),
    /simulated interrupted write/,
  );
  assert.deepEqual(await readdir(data.output), []);
  await mkdir(destination);
  await writeFile(path.join(destination, "keep.txt"), "preserve");
  await assert.rejects(
    atomicDirectory(destination, async () => {}),
    /already exists/,
  );
  assert.equal(await readFile(path.join(destination, "keep.txt"), "utf8"), "preserve");
});

test("CLI entrypoint verifies a snapshot and emits counts without object details", async (t) => {
  const data = await fixture();
  t.after(() => rm(data.root, { recursive: true, force: true }));
  const backup = path.join(data.output, "backup");
  await exportBackup({
    metadataPath: data.metadataPath,
    objectsPath: data.source,
    destination: backup,
  });
  const result = spawnSync(
    process.execPath,
    [path.resolve("scripts/document-backup.mjs"), "verify", "--backup", backup],
    { cwd: path.resolve("."), encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    command: "verify",
    documentCount: 1,
    totalBytes: pdf.length,
  });
});

test("reconciliation reports missing and orphan synthetic objects without deleting them", async (t) => {
  const data = await fixture();
  t.after(() => rm(data.root, { recursive: true, force: true }));
  await rm(path.join(data.source, "synthetic", "sample.pdf"));
  await writeFile(path.join(data.source, "synthetic", "orphan.pdf"), pdf);

  assert.deepEqual(
    await reconcileFixture({
      metadataPath: data.metadataPath,
      objectsPath: data.source,
    }),
    { metadataCount: 1, objectCount: 1, missingCount: 1, orphanCount: 1 },
  );
  assert.deepEqual(await readdir(path.join(data.source, "synthetic")), ["orphan.pdf"]);
});

test("backup format rejects path traversal and invalid dates before filesystem copy", async (t) => {
  const data = await fixture();
  t.after(() => rm(data.root, { recursive: true, force: true }));
  const invalid = structuredClone(data.metadata);
  invalid.documents[0].storageKey = "synthetic/../customer.pdf";
  await writeFile(data.metadataPath, JSON.stringify(invalid));
  await assert.rejects(
    exportBackup({
      metadataPath: data.metadataPath,
      objectsPath: data.source,
      destination: path.join(data.output, "traversal"),
    }),
    /invalid synthetic object key/,
  );
  invalid.documents[0].storageKey = "synthetic/sample.pdf";
  invalid.documents[0].createdAt = "not-a-date";
  await writeFile(data.metadataPath, JSON.stringify(invalid));
  await assert.rejects(
    exportBackup({
      metadataPath: data.metadataPath,
      objectsPath: data.source,
      destination: path.join(data.output, "invalid-date"),
    }),
    /invalid or non-synthetic/,
  );
  assert.deepEqual(await readdir(data.output), []);
});
