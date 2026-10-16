import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { ServiceUnavailableException } from "@nestjs/common";
import { StorageService } from "./storage.service";

test("production upload writes remain disabled even if the flag is enabled", async () => {
  const priorNodeEnv = process.env.NODE_ENV;
  const priorUploadWrites = process.env.UPLOAD_WRITES_ENABLED;
  process.env.NODE_ENV = "production";

  try {
    for (const setting of ["false", "true"]) {
      process.env.UPLOAD_WRITES_ENABLED = setting;
      const storage = new StorageService();
      await assert.rejects(storage.put(Buffer.from("data"), "file.txt", "text/plain"), (error: unknown) => {
        return error instanceof ServiceUnavailableException && error.getStatus() === 503;
      });
    }
  } finally {
    if (priorNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = priorNodeEnv;
    if (priorUploadWrites === undefined) delete process.env.UPLOAD_WRITES_ENABLED;
    else process.env.UPLOAD_WRITES_ENABLED = priorUploadWrites;
  }
});

test("enabled local uploads retain their existing write and read behavior", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "zat-storage-test-"));
  const priorNodeEnv = process.env.NODE_ENV;
  const priorUploadWrites = process.env.UPLOAD_WRITES_ENABLED;
  const priorStoragePath = process.env.LOCAL_STORAGE_PATH;
  process.env.NODE_ENV = "test";
  process.env.UPLOAD_WRITES_ENABLED = "true";
  process.env.LOCAL_STORAGE_PATH = root;

  try {
    const storage = new StorageService();
    const body = Buffer.from("plain text");
    const uploaded = await storage.put(body, "file.txt", "text/plain");
    assert.deepEqual(await storage.get(uploaded.key), body);
    assert.deepEqual(await readFile(path.join(root, uploaded.key)), body);
  } finally {
    await rm(root, { recursive: true, force: true });
    if (priorNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = priorNodeEnv;
    if (priorUploadWrites === undefined) delete process.env.UPLOAD_WRITES_ENABLED;
    else process.env.UPLOAD_WRITES_ENABLED = priorUploadWrites;
    if (priorStoragePath === undefined) delete process.env.LOCAL_STORAGE_PATH;
    else process.env.LOCAL_STORAGE_PATH = priorStoragePath;
  }
});
