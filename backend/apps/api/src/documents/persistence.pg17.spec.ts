import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID, createHash } from "node:crypto";
import { mkdtemp, copyFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { StorageService } from "../common/storage.service";
import { DocumentsController } from "./documents.controller";
import { AuditService } from "../common/audit.service";
import type { AuthUser } from "../auth/auth.types";

test("PG17 synthetic document persistence and scoped read acceptance", { skip: !process.env.ZAT_SYNTHETIC_DATABASE_URL }, async t => {
  const url = new URL(process.env.ZAT_SYNTHETIC_DATABASE_URL!);
  assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, "55463"); assert.equal(url.pathname, "/zat_synthetic_manual_workflows");
  const db = new PrismaClient({ datasourceUrl: url.toString() });
  const keys = ["NODE_ENV", "DOCUMENT_UPLOADS_ENABLED", "STORAGE_DRIVER", "LOCAL_STORAGE_PATH"];
  const previous = new Map(keys.map(key => [key, process.env[key]]));
  try {
    Object.assign(process.env, { NODE_ENV: "test", DOCUMENT_UPLOADS_ENABLED: "true", STORAGE_DRIVER: "local", LOCAL_STORAGE_PATH: await mkdtemp(join(tmpdir(), "zat-synthetic-docs-")) });
    const branch = await db.branch.create({ data: { code: randomUUID(), name: "Synthetic document branch" } });
    const staff = await db.user.create({ data: { username: randomUUID(), email: `${randomUUID()}@example.test`, fullName: "Synthetic document staff", passwordHash: "invalid" } });
    const party = await db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Synthetic document owner", branchId: branch.id } });
    const actor = { id: staff.id, isSuperAdmin: true, branchIds: [branch.id], defaultBranchId: branch.id } as AuthUser;
    const request = { user: actor } as never;
    const storage = new StorageService();
    const controller = new DocumentsController(db as never, storage, new AuditService(db as never));
    const bytes = Buffer.from("%PDF-1.7\nSynthetic persistence fixture. No customer data.\n");
    const file = { buffer: bytes, originalname: "synthetic.pdf", mimetype: "application/pdf" } as Express.Multer.File;
    const document = await controller.upload(file, { entityType: "customer", entityId: party.id }, request);
    await t.test("fresh storage/controller instances retrieve matching persisted bytes and private headers", async () => {
      const stored = await db.storedDocument.findUniqueOrThrow({ where: { id: document.id } });
      const reopenedStorage = new StorageService();
      assert.equal(createHash("sha256").update(await reopenedStorage.get(stored.storageKey)).digest("hex"), createHash("sha256").update(bytes).digest("hex"));
      const headers: Record<string, string> = {};let downloaded: Buffer | undefined;
      const response = { setHeader: (key: string, value: string) => { headers[key] = value; }, send: (data: Buffer) => { downloaded = data; } };
      await new DocumentsController(db as never, reopenedStorage, new AuditService(db as never)).download(document.id, response as never, request);
      assert.deepEqual(downloaded, bytes);assert.equal(headers["Cache-Control"], "private, no-store");assert.equal(headers["X-Content-Type-Options"], "nosniff");
    });
    await t.test("foreign branch cannot read or attach to another owner's record", async () => {
      const foreign = { user: { ...actor, isSuperAdmin: false, branchIds: [], defaultBranchId: null, permissions: ["customer.view", "document.create", "document.view"] } } as never;
      await assert.rejects(controller.download(document.id, {} as never, foreign), { status: 404 });
      const count = await db.storedDocument.count();
      await assert.rejects(controller.upload(file, { entityType: "customer", entityId: party.id }, foreign), { status: 404 });
      assert.equal(await db.storedDocument.count(), count);
    });
    await t.test("disabled flag, content mismatch and traversal fail before metadata writes", async () => {
      const count = await db.storedDocument.count();
      process.env.DOCUMENT_UPLOADS_ENABLED = "false";
      await assert.rejects(controller.upload(file, { entityType: "customer", entityId: party.id }, request), { status: 503 });
      process.env.DOCUMENT_UPLOADS_ENABLED = "true";
      await assert.rejects(controller.upload({ ...file, buffer: Buffer.from("not pdf") }, { entityType: "customer", entityId: party.id }, request), { status: 400 });
      await assert.rejects(storage.get("../secrets"), { status: 400 });
      assert.equal(await db.storedDocument.count(), count);
    });
    await t.test("missing bytes fail safely and a backup restores the same document after process restart", async () => {
      const stored = await db.storedDocument.findUniqueOrThrow({ where: { id: document.id } });
      const objectPath = join(process.env.LOCAL_STORAGE_PATH!, stored.storageKey);
      const backupRoot = await mkdtemp(join(tmpdir(), "zat-synthetic-object-backup-"));
      const backupPath = join(backupRoot, "fixture.pdf");
      await copyFile(objectPath, backupPath);
      await storage.delete(stored.storageKey);
      await assert.rejects(controller.download(document.id, {} as never, request), { status: 503 });
      assert.equal(await db.storedDocument.count({ where: { id: document.id } }), 1);
      await mkdir(dirname(objectPath), { recursive: true });
      await copyFile(backupPath, objectPath);
      const childScript = [
        "const {StorageService}=require(process.argv[1]);",
        "new StorageService().get(process.argv[2]).then(bytes=>",
        "console.log(require('node:crypto').createHash('sha256').update(bytes).digest('hex'))",
        ").catch(()=>process.exitCode=1);",
      ].join("");
      const hash = execFileSync(process.execPath, [
        "-e", childScript, resolve("apps/api/dist/common/storage.service.js"), stored.storageKey,
      ], { encoding: "utf8", env: process.env }).trim();
      assert.equal(hash, createHash("sha256").update(bytes).digest("hex"));
      await rm(backupRoot, { recursive: true, force: true });
    });
  } finally {
    for (const [key,value] of previous) if (value === undefined) delete process.env[key]; else process.env[key] = value;
    await db.$disconnect();
  }
});
