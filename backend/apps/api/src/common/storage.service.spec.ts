import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StorageService } from "./storage.service";

test("production blocks upload writes by default while existing downloads remain readable", async () => {
  const previous = { ...process.env };
  const root = await mkdtemp(join(tmpdir(), "zat-storage-test-"));
  try {
    process.env.NODE_ENV = "production";
    delete process.env.DOCUMENT_UPLOADS_ENABLED;
    process.env.LOCAL_STORAGE_PATH = root;
    await writeFile(join(root, "existing.txt"), "fixture");
    const storage = new StorageService();
    await assert.rejects(storage.put(Buffer.from("new"), "new.txt", "text/plain"), /temporarily unavailable/);
    assert.equal((await storage.get("existing.txt")).toString(), "fixture");
    process.env.DOCUMENT_UPLOADS_ENABLED = "false";
    await assert.rejects(storage.put(Buffer.from("new"), "new.txt", "text/plain"), /temporarily unavailable/);
    process.env.DOCUMENT_UPLOADS_ENABLED = "true";
    const result = await storage.put(Buffer.from("new"), "new.txt", "text/plain");
    assert.equal((await storage.get(result.key)).toString(), "new");
  } finally {
    for (const key of ["NODE_ENV", "DOCUMENT_UPLOADS_ENABLED", "LOCAL_STORAGE_PATH"]) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    await rm(root, { recursive: true, force: true });
  }
});
