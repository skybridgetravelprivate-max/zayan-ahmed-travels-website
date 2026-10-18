import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const FORMAT = "zat-synthetic-document-backup";
const FIXTURE_FORMAT = "zat-synthetic-document-fixture";
const VERSION = 1;
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
const MAX_DOCUMENTS = 1000;
const MAX_METADATA_BYTES = 1024 * 1024;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MIME_EXTENSIONS = new Map([
  ["application/pdf", ".pdf"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["text/plain", ".txt"],
]);

class BackupToolError extends Error {}

function fail(message) {
  throw new BackupToolError(message);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIsoDate(value) {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function validateSyntheticKey(key) {
  if (
    typeof key !== "string" ||
    !key.startsWith("synthetic/") ||
    key.length > 180 ||
    key.split("/").some((segment) =>
      !segment ||
      segment === "." ||
      segment === ".." ||
      !/^[A-Za-z0-9._-]+$/.test(segment),
    )
  ) {
    fail("Fixture contains an invalid synthetic object key.");
  }
}

function matchesContent(bytes, mimeType) {
  switch (mimeType) {
    case "application/pdf":
      return bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-";
    case "image/jpeg":
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png":
      return bytes.length >= 8 &&
        bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/webp":
      return bytes.length >= 12 &&
        bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WEBP";
    case "text/plain":
      try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        return !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

function validateFixture(value) {
  if (
    !isPlainObject(value) ||
    value.format !== FIXTURE_FORMAT ||
    value.version !== VERSION ||
    !Array.isArray(value.documents) ||
    value.documents.length > MAX_DOCUMENTS
  ) {
    fail("Metadata must be a supported synthetic document fixture.");
  }

  const ids = new Set();
  const keys = new Set();
  let totalBytes = 0;
  for (const document of value.documents) {
    const expectedFields = [
      "createdAt",
      "entityId",
      "entityType",
      "fileName",
      "id",
      "mimeType",
      "sizeBytes",
      "status",
      "storageKey",
      "synthetic",
      "uploadedById",
    ];
    if (
      !isPlainObject(document) ||
      Object.keys(document).sort().join("\0") !== expectedFields.sort().join("\0") ||
      document.synthetic !== true ||
      typeof document.id !== "string" ||
      !document.id.startsWith("synthetic-") ||
      ids.has(document.id) ||
      typeof document.entityId !== "string" ||
      !document.entityId.startsWith("synthetic-") ||
      typeof document.uploadedById !== "string" ||
      !document.uploadedById.startsWith("synthetic-") ||
      typeof document.entityType !== "string" ||
      !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(document.entityType) ||
      typeof document.fileName !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(document.fileName) ||
      !isIsoDate(document.createdAt) ||
      document.status !== "UPLOADED" ||
      !Number.isSafeInteger(document.sizeBytes) ||
      document.sizeBytes < 1 ||
      document.sizeBytes > MAX_DOCUMENT_BYTES ||
      !MIME_EXTENSIONS.has(document.mimeType)
    ) {
      fail("Metadata contains an invalid or non-synthetic document record.");
    }
    validateSyntheticKey(document.storageKey);
    if (keys.has(document.storageKey)) {
      fail("Metadata contains duplicate synthetic object keys.");
    }
    const expectedExtension = MIME_EXTENSIONS.get(document.mimeType);
    const actualExtension = path.posix.extname(document.storageKey).toLowerCase();
    const fileNameExtension = path.posix.extname(document.fileName).toLowerCase();
    if (
      actualExtension !== expectedExtension &&
      !(expectedExtension === ".jpg" && actualExtension === ".jpeg")
    ) {
      fail("A synthetic object key extension does not match its declared type.");
    }
    if (
      fileNameExtension !== expectedExtension &&
      !(expectedExtension === ".jpg" && fileNameExtension === ".jpeg")
    ) {
      fail("A synthetic filename extension does not match its declared type.");
    }
    totalBytes += document.sizeBytes;
    if (totalBytes > MAX_TOTAL_BYTES) {
      fail("Synthetic backup exceeds the 64 MiB aggregate limit.");
    }
    ids.add(document.id);
    keys.add(document.storageKey);
  }
  return { ids, keys, totalBytes };
}

async function readRegularFile(filePath, message, maxBytes = MAX_TOTAL_BYTES) {
  await assertNoSymlinkComponents(filePath, message);
  let details;
  try {
    details = await lstat(filePath);
  } catch {
    fail(message);
  }
  if (!details.isFile() || details.isSymbolicLink()) fail(message);
  if (details.size > maxBytes) fail(message);
  try {
    const bytes = await readFile(filePath);
    if (bytes.length > maxBytes) fail(message);
    return bytes;
  } catch {
    fail(message);
  }
}

async function readSourceObject(root, key) {
  const segments = key.split("/");
  let current = root;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    let details;
    try {
      details = await lstat(current);
    } catch {
      fail("A fixture object is missing.");
    }
    if (
      details.isSymbolicLink() ||
      (index === segments.length - 1 ? !details.isFile() : !details.isDirectory())
    ) {
      fail("Fixture objects must be regular files under a regular directory.");
    }
  }
  const bytes = await readRegularFile(
    current,
    "A fixture object could not be read.",
    MAX_DOCUMENT_BYTES,
  );
  if (bytes.length > MAX_DOCUMENT_BYTES) fail("A fixture object exceeds the 8 MiB limit.");
  return bytes;
}

async function walkRegularFiles(root) {
  const files = [];
  async function walk(directory, relative) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      fail("An input directory could not be read.");
    }
    for (const entry of entries) {
      const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
      const fullPath = path.join(directory, entry.name);
      let details;
      try {
        details = await lstat(fullPath);
      } catch {
        fail("An input directory entry could not be inspected.");
      }
      if (details.isSymbolicLink()) fail("Symbolic links are not accepted.");
      if (details.isDirectory()) {
        await walk(fullPath, childRelative);
      } else if (details.isFile()) {
        files.push(childRelative);
      } else {
        fail("Only regular files and directories are accepted.");
      }
    }
  }
  await walk(root, "");
  return files;
}

function resolveOutputPaths(destination) {
  const resolved = path.resolve(destination);
  const leaf = path.basename(resolved);
  if (!leaf || leaf === "." || leaf === path.parse(resolved).root) {
    fail("Output destination must be a new child path.");
  }
  return { resolved, parent: path.dirname(resolved), leaf };
}

function isNested(first, second) {
  const relative = path.relative(first, second);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function assertNoSymlinkComponents(target, message) {
  const absolute = path.resolve(target);
  const { root } = path.parse(absolute);
  let current = root;
  for (const segment of absolute.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    let details;
    try {
      details = await lstat(current);
    } catch {
      fail(message);
    }
    if (details.isSymbolicLink()) fail(message);
  }
}

async function assertDirectory(directory, message) {
  await assertNoSymlinkComponents(directory, message);
  let details;
  try {
    details = await lstat(directory);
  } catch {
    fail(message);
  }
  if (!details.isDirectory() || details.isSymbolicLink()) fail(message);
}

async function assertPathAbsent(target, message) {
  try {
    await lstat(target);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    fail(message);
  }
  fail(message);
}

async function atomicDirectory(destination, writeStage) {
  const { resolved, parent, leaf } = resolveOutputPaths(destination);
  await assertDirectory(parent, "Output parent must already exist as a non-symlink directory.");
  await assertPathAbsent(resolved, "Output destination already exists.");
  const stage = path.join(parent, `.${leaf}.tmp-${randomUUID()}`);
  try {
    await mkdir(stage, { mode: 0o700 });
    await writeStage(stage);
    await rename(stage, resolved);
  } catch (error) {
    try {
      await rm(stage, { recursive: true, force: true });
    } catch {
      throw new BackupToolError("Operation failed and its temporary output could not be removed.");
    }
    throw error;
  }
}

async function loadMetadata(metadataPath) {
  const bytes = await readRegularFile(
    metadataPath,
    "Metadata input must be a readable regular file.",
    MAX_METADATA_BYTES,
  );
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("Metadata input is not valid JSON.");
  }
  validateFixture(value);
  return { bytes, value };
}

async function exportBackup({ metadataPath, objectsPath, destination }) {
  const { bytes: metadataBytes, value: metadata } = await loadMetadata(metadataPath);
  const sourceRoot = path.resolve(objectsPath);
  await assertDirectory(sourceRoot, "Object source must be an existing non-symlink directory.");
  const resolvedDestination = path.resolve(destination);
  if (isNested(sourceRoot, resolvedDestination) || isNested(resolvedDestination, sourceRoot)) {
    fail("Backup output and object source must not contain one another.");
  }

  const records = [];
  let totalBytes = 0;
  for (const document of metadata.documents) {
    const objectBytes = await readSourceObject(sourceRoot, document.storageKey);
    if (
      objectBytes.length !== document.sizeBytes ||
      !matchesContent(objectBytes, document.mimeType)
    ) {
      fail("A fixture object does not match its metadata size or declared content type.");
    }
    const digest = sha256(objectBytes);
    records.push({
      id: document.id,
      storageKey: document.storageKey,
      sizeBytes: objectBytes.length,
      sha256: digest,
    });
    totalBytes += objectBytes.length;
  }

  const manifest = {
    format: FORMAT,
    version: VERSION,
    createdAt: new Date().toISOString(),
    metadataSha256: sha256(metadataBytes),
    documents: records,
  };
  await atomicDirectory(destination, async (stage) => {
    await mkdir(path.join(stage, "objects"), { mode: 0o700 });
    await writeFile(path.join(stage, "metadata.json"), metadataBytes, { flag: "wx", mode: 0o600 });
    for (const record of records) {
      const target = path.join(stage, "objects", ...record.storageKey.split("/"));
      await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
      const bytes = await readSourceObject(sourceRoot, record.storageKey);
      if (sha256(bytes) !== record.sha256 || bytes.length !== record.sizeBytes) {
        fail("A fixture object changed while its backup was being written.");
      }
      await writeFile(target, bytes, { flag: "wx", mode: 0o600 });
    }
    await writeFile(path.join(stage, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600,
    });
    await verifyBackup(stage);
  });
  return { documentCount: records.length, totalBytes };
}

async function verifyBackup(backupPath) {
  const root = path.resolve(backupPath);
  await assertDirectory(root, "Backup must be an existing non-symlink directory.");
  const entries = await readdir(root);
  if (
    entries.length !== 3 ||
    !["manifest.json", "metadata.json", "objects"].every((name) => entries.includes(name))
  ) {
    fail("Backup has missing or unexpected top-level entries.");
  }

  const manifestBytes = await readRegularFile(
    path.join(root, "manifest.json"),
    "Backup manifest is invalid.",
    MAX_MANIFEST_BYTES,
  );
  const metadataBytes = await readRegularFile(
    path.join(root, "metadata.json"),
    "Backup metadata is invalid.",
    MAX_METADATA_BYTES,
  );
  let manifest;
  let metadata;
  try {
    manifest = JSON.parse(manifestBytes.toString("utf8"));
    metadata = JSON.parse(metadataBytes.toString("utf8"));
  } catch {
    fail("Backup manifest or metadata is not valid JSON.");
  }
  const fixture = validateFixture(metadata);
  const objectsRoot = path.join(root, "objects");
  await assertDirectory(objectsRoot, "Backup objects entry must be a directory.");
  const storedPaths = await walkRegularFiles(objectsRoot);
  const expectedPaths = metadata.documents
    .map((document) => document.storageKey)
    .sort();
  const actualPaths = storedPaths.sort();
  const actualPathSet = new Set(actualPaths);
  const expectedPathSet = new Set(expectedPaths);
  if (actualPaths.some((objectPath) => !expectedPathSet.has(objectPath))) {
    fail("Backup objects contain unexpected or orphan files.");
  }
  if (expectedPaths.some((objectPath) => !actualPathSet.has(objectPath))) {
    fail("Backup is missing one or more expected object files.");
  }
  if (
    !isPlainObject(manifest) ||
    Object.keys(manifest).sort().join("\0") !==
      ["createdAt", "documents", "format", "metadataSha256", "version"].sort().join("\0") ||
    manifest.format !== FORMAT ||
    manifest.version !== VERSION ||
    !isIsoDate(manifest.createdAt) ||
    !/^[a-f0-9]{64}$/.test(manifest.metadataSha256) ||
    !Array.isArray(manifest.documents) ||
    sha256(metadataBytes) !== manifest.metadataSha256
  ) {
    fail("Backup manifest does not match its metadata.");
  }

  const byKey = new Map();
  const ids = new Set();
  for (const record of manifest.documents) {
    if (
      !isPlainObject(record) ||
      Object.keys(record).sort().join("\0") !== ["id", "sha256", "sizeBytes", "storageKey"].sort().join("\0") ||
      typeof record.id !== "string" ||
      ids.has(record.id) ||
      typeof record.storageKey !== "string" ||
      !Number.isSafeInteger(record.sizeBytes) ||
      record.sizeBytes < 1 ||
      record.sizeBytes > MAX_DOCUMENT_BYTES ||
      !/^[a-f0-9]{64}$/.test(record.sha256) ||
      byKey.has(record.storageKey)
    ) {
      fail("Backup manifest contains an invalid object record.");
    }
    validateSyntheticKey(record.storageKey);
    ids.add(record.id);
    byKey.set(record.storageKey, record);
  }
  if (manifest.documents.length !== metadata.documents.length) {
    fail("Backup manifest does not match its metadata.");
  }

  let totalBytes = 0;
  for (const document of metadata.documents) {
    const record = byKey.get(document.storageKey);
    if (
      !record ||
      record.id !== document.id ||
      record.sizeBytes !== document.sizeBytes
    ) {
      fail("Backup manifest is missing or mismatches a metadata record.");
    }
    const objectPath = path.join(root, "objects", ...document.storageKey.split("/"));
    const objectBytes = await readRegularFile(objectPath, "A backup object is missing or invalid.");
    if (
      objectBytes.length !== document.sizeBytes ||
      sha256(objectBytes) !== record.sha256 ||
      !matchesContent(objectBytes, document.mimeType)
    ) {
      fail("A backup object failed size, checksum, or content validation.");
    }
    totalBytes += objectBytes.length;
  }

  if (fixture.totalBytes !== totalBytes) {
    fail("Backup aggregate object size does not match its metadata.");
  }
  return { documentCount: metadata.documents.length, totalBytes };
}

async function restoreBackup({ backupPath, destination }) {
  const result = await verifyBackup(backupPath);
  const source = path.resolve(backupPath);
  const resolvedDestination = path.resolve(destination);
  if (isNested(source, resolvedDestination) || isNested(resolvedDestination, source)) {
    fail("Restore output and backup source must not contain one another.");
  }
  await atomicDirectory(destination, async (stage) => {
    const metadataBytes = await readRegularFile(path.join(source, "metadata.json"), "Backup metadata is invalid.");
    const manifestBytes = await readRegularFile(path.join(source, "manifest.json"), "Backup manifest is invalid.");
    await mkdir(path.join(stage, "objects"), { mode: 0o700 });
    await writeFile(path.join(stage, "metadata.json"), metadataBytes, { flag: "wx", mode: 0o600 });
    await writeFile(path.join(stage, "manifest.json"), manifestBytes, { flag: "wx", mode: 0o600 });
    const metadata = JSON.parse(metadataBytes.toString("utf8"));
    for (const document of metadata.documents) {
      const relative = path.join("objects", ...document.storageKey.split("/"));
      const sourceObject = path.join(source, relative);
      const targetObject = path.join(stage, relative);
      await mkdir(path.dirname(targetObject), { recursive: true, mode: 0o700 });
      const objectBytes = await readRegularFile(sourceObject, "Backup object changed during restore.");
      await writeFile(targetObject, objectBytes, { flag: "wx", mode: 0o600 });
    }
    await verifyBackup(stage);
  });
  return result;
}

async function reconcileFixture({ metadataPath, objectsPath }) {
  const { value: metadata } = await loadMetadata(metadataPath);
  const root = path.resolve(objectsPath);
  await assertDirectory(root, "Object source must be an existing non-symlink directory.");
  const actual = await walkRegularFiles(root);
  const actualSet = new Set(actual);
  const expected = new Set(metadata.documents.map((document) => document.storageKey));
  let missingCount = 0;
  let orphanCount = 0;
  for (const key of expected) {
    if (!actualSet.has(key)) missingCount += 1;
  }
  for (const key of actualSet) {
    if (!expected.has(key)) orphanCount += 1;
  }
  return { metadataCount: expected.size, objectCount: actualSet.size, missingCount, orphanCount };
}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  const expected = {
    export: ["metadata", "objects", "destination"],
    verify: ["backup"],
    restore: ["backup", "destination"],
    reconcile: ["metadata", "objects"],
  }[command];
  if (!expected) fail("Usage: document-backup.mjs <export|verify|restore|reconcile> --name value ...");
  const values = new Map();
  for (let index = 0; index < rest.length; index += 2) {
    const option = rest[index];
    const value = rest[index + 1];
    if (
      typeof option !== "string" ||
      !option.startsWith("--") ||
      typeof value !== "string" ||
      !value ||
      values.has(option.slice(2))
    ) {
      fail("Arguments must be unique --name value pairs.");
    }
    values.set(option.slice(2), value);
  }
  if (
    values.size !== expected.length ||
    expected.some((name) => !values.has(name))
  ) {
    fail("Arguments do not match the selected command.");
  }
  return { command, values: Object.fromEntries(values) };
}

async function main(argv) {
  const { command, values } = parseArguments(argv);
  let result;
  if (command === "export") result = await exportBackup({
    metadataPath: values.metadata,
    objectsPath: values.objects,
    destination: values.destination,
  });
  else if (command === "verify") result = await verifyBackup(values.backup);
  else if (command === "restore") result = await restoreBackup({
    backupPath: values.backup,
    destination: values.destination,
  });
  else result = await reconcileFixture({
    metadataPath: values.metadata,
    objectsPath: values.objects,
  });
  process.stdout.write(`${JSON.stringify({ command, ...result })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    const message = error instanceof BackupToolError
      ? error.message
      : "Operation failed due to an unexpected filesystem or runtime error.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}

export {
  atomicDirectory,
  exportBackup,
  reconcileFixture,
  restoreBackup,
  validateFixture,
  verifyBackup,
};
