import assert from "node:assert/strict";
import test from "node:test";
import { createServer, type Server } from "node:http";
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve, sep } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";
import { StorageService } from "../common/storage.service";
import { AuditService } from "../common/audit.service";
import { DocumentsController } from "./documents.controller";
import type { AuthUser } from "../auth/auth.types";

test("PG17 local private-storage HTTP adapter recovery acceptance", { skip: !process.env.ZAT_SYNTHETIC_DATABASE_URL }, async t => {
  const target = new URL(process.env.ZAT_SYNTHETIC_DATABASE_URL!);
  assert.equal(target.hostname, "127.0.0.1"); assert.equal(target.port, "55463");
  assert.equal(target.pathname, "/zat_synthetic_manual_workflows");
  const db = new PrismaClient({ datasourceUrl: target.toString() });
  const root = await mkdtemp(join(tmpdir(), "zat-private-http-"));
  const objects = join(root, "objects");
  const key = "synthetic-service-" + randomUUID(), bucket = "synthetic-private";
  const envKeys = ["NODE_ENV", "DOCUMENT_UPLOADS_ENABLED", "STORAGE_DRIVER", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_STORAGE_BUCKET"];
  const beforeEnv = new Map(envKeys.map(name => [name, process.env[name]]));
  let server: Server | undefined, publicBucket = false, breakObjects = false, objectReads = 0;
  async function start() {
    server = createServer(async (request, response) => {
      try {
        if (request.headers.authorization !== `Bearer ${key}` || request.headers.apikey !== key) { response.writeHead(401).end(); return; }
        const pathname = new URL(request.url!, "http://127.0.0.1").pathname;
        if (pathname === `/storage/v1/bucket/${bucket}`) { response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify({ public: publicBucket })); return; }
        const prefix = `/storage/v1/object/${bucket}/`;
        if (!pathname.startsWith(prefix)) { response.writeHead(404).end(); return; }
        if (breakObjects) { request.socket.destroy(); return; }
        const relative = decodeURIComponent(pathname.slice(prefix.length));
        assert.match(relative, /^\d{4}\/[0-9a-f-]{36}\.pdf$/);
        const file = join(objects, relative);
        if (request.method === "POST") {
          assert.equal(request.headers["x-upsert"], "false");
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          await mkdir(dirname(file), { recursive: true });
          await writeFile(file, Buffer.concat(chunks), { flag: "wx" });
          response.setHeader("Content-Type", "application/json"); response.end("{}");
        } else if (request.method === "GET") {
          objectReads++;
          try { response.end(await readFile(file)); } catch { response.writeHead(404).end(); }
        } else { response.writeHead(405).end(); }
      } catch { response.writeHead(500).end(); }
    });
    await new Promise<void>(done => server!.listen(0, "127.0.0.1", done));
    const address = server.address(); assert.ok(address && typeof address !== "string");
    process.env.SUPABASE_URL = `http://127.0.0.1:${address.port}`;
  }
  async function stop() { if (server) { const running = server; server = undefined; running.closeAllConnections(); await new Promise<void>((done, reject) => running.close(error => error ? reject(error) : done())); } }
  try {
    const [version] = await db.$queryRaw<{ version: number }[]>`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(version.version >= 170000 && version.version < 180000);
    Object.assign(process.env, { NODE_ENV: "production", DOCUMENT_UPLOADS_ENABLED: "true", STORAGE_DRIVER: "supabase", SUPABASE_SERVICE_ROLE_KEY: key, SUPABASE_STORAGE_BUCKET: bucket });
    await start();
    const branch = await db.branch.create({ data: { code: randomUUID(), name: "Synthetic private HTTP branch" } });
    const staff = await db.user.create({ data: { username: randomUUID(), email: `${randomUUID()}@example.test`, fullName: "Synthetic private HTTP staff", passwordHash: "invalid" } });
    const customer = await db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Synthetic private object owner", branchId: branch.id } });
    const actor = { id: staff.id, isSuperAdmin: true, branchIds: [branch.id], defaultBranchId: branch.id } as AuthUser;
    const storage = new StorageService(), controller = new DocumentsController(db as never, storage, new AuditService(db as never));
    const bytes = Buffer.from("%PDF-1.7\nSynthetic private adapter recovery.\n");
    const uploaded = await controller.upload({ buffer: bytes, originalname: "synthetic.pdf", mimetype: "application/pdf" } as Express.Multer.File, { entityType: "customer", entityId: customer.id }, { user: actor } as never);
    const metadata = await db.storedDocument.findUniqueOrThrow({ where: { id: uploaded.id } });
    const diskPath = join(objects, metadata.storageKey.slice("supabase/".length));
    await t.test("real HTTP upload/download stores private bytes and denies anonymous object access", async () => {
      assert.deepEqual(await readFile(diskPath), bytes);
      const headers: Record<string, string> = {}; let downloaded: Buffer | undefined;
      await controller.download(uploaded.id, { setHeader: (name: string, value: string) => { headers[name] = value; }, send: (value: Buffer) => { downloaded = value; } } as never, { user: actor } as never);
      assert.deepEqual(downloaded, bytes); assert.equal(headers["Cache-Control"], "private, no-store");
      const objectUrl = `${process.env.SUPABASE_URL}/storage/v1/object/${bucket}/${metadata.storageKey.slice("supabase/".length)}`;
      assert.equal((await fetch(objectUrl)).status, 401);
      const reads = objectReads;
      await assert.rejects(controller.download(uploaded.id, {} as never, { user: { ...actor, isSuperAdmin: false, branchIds: [], defaultBranchId: null, permissions: ["customer.view", "document.view"] } } as never), { status: 404 });
      assert.equal(objectReads, reads);
    });
    await t.test("public bucket configuration is rejected before reading bytes", async () => {
      publicBucket = true; const reads = objectReads;
      await assert.rejects(storage.get(metadata.storageKey), { status: 503 });
      assert.equal(objectReads, reads); publicBucket = false;
    });
    await t.test("object transport failure returns a sanitized unavailable response", async () => {
      breakObjects = true;
      try { await assert.rejects(storage.get(metadata.storageKey), { status: 503, message: "Private document storage could not be reached." }); }
      finally { breakObjects = false; }
    });
    await t.test("paired metadata and bytes survive server restart and missing-object restoration", async () => {
      const backup = join(root, "backup.pdf"), metadataBackup = join(root, "metadata.json");
      await copyFile(diskPath, backup); await writeFile(metadataBackup, JSON.stringify(metadata));
      await stop(); await start();
      assert.deepEqual(await new StorageService().get(metadata.storageKey), bytes);
      await rm(diskPath);
      await assert.rejects(controller.download(uploaded.id, {} as never, { user: actor } as never), { status: 503 });
      assert.equal(await db.storedDocument.count({ where: { id: uploaded.id } }), 1);
      assert.equal(JSON.stringify(await db.storedDocument.findUniqueOrThrow({ where: { id: uploaded.id } })), await readFile(metadataBackup, "utf8"));
      await copyFile(backup, diskPath);
      const child = "const {StorageService}=require(process.argv[1]);new StorageService().get(process.argv[2]).then(b=>console.log(require('node:crypto').createHash('sha256').update(b).digest('hex'))).catch(()=>process.exitCode=1)";
      const result = await promisify(execFile)(process.execPath, ["-e", child, resolve(__dirname, "../../dist/common/storage.service.js"), metadata.storageKey], { env: process.env, encoding: "utf8", windowsHide: true });
      assert.equal(result.stdout.trim(), createHash("sha256").update(bytes).digest("hex"));
    });
  } finally {
    await stop(); await db.$disconnect();
    for (const [name, value] of beforeEnv) if (value === undefined) delete process.env[name]; else process.env[name] = value;
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep + "zat-private-http-"));
    await rm(root, { recursive: true, force: true });
  }
});
