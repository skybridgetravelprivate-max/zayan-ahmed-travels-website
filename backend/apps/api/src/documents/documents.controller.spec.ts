import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import type { AuthUser } from "../auth/auth.types";
import { PERMISSION_KEY } from "../auth/permission.guard";
import { AuditService } from "../common/audit.service";
import type { PrismaService } from "../common/prisma.service";
import type { StorageService } from "../common/storage.service";
import { DocumentsController } from "./documents.controller";

const user: AuthUser = {
  id: "staff-a",
  email: "staff@example.test",
  username: "staff-a",
  fullName: "Staff A",
  permissions: ["lead.view", "document.delete"],
  roleNames: ["Sales"],
  branchIds: ["branch-a"],
  defaultBranchId: null,
  isSuperAdmin: false,
};

const file = {
  buffer: Buffer.from("%PDF-1.7\nsynthetic"),
  originalname: "fixture.pdf",
  mimetype: "application/pdf",
} as Express.Multer.File;

function setup(overrides: {
  leadBranchId?: string | null;
  metadataCreate?: (args: unknown) => Promise<unknown>;
  metadataFindFirst?: () => Promise<unknown>;
  document?: Record<string, unknown> | null;
  deleteMetadata?: () => Promise<unknown>;
  storageDelete?: () => Promise<void>;
  storageGet?: () => Promise<Buffer>;
} = {}) {
  const storageCalls: string[] = [];
  const createArgs: unknown[] = [];
  const auditRows: unknown[] = [];
  const recordAudit = async ({ data }: { data: unknown }) => {
    auditRows.push(data);
    return data;
  };
  const db = {
    lead: {
      findUnique: async () =>
        overrides.leadBranchId === null
          ? null
          : { id: "lead-a", branchId: overrides.leadBranchId ?? "branch-a" },
    },
    storedDocument: {
      create: async (args: unknown) => {
        createArgs.push(args);
        return overrides.metadataCreate
          ? overrides.metadataCreate(args)
          : {
              id: "doc-a",
              fileName: "fixture.pdf",
              mimeType: "application/pdf",
              sizeBytes: file.buffer.length,
              entityType: "lead",
              entityId: "lead-a",
              status: "UPLOADED",
              uploadedById: user.id,
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
            };
      },
      findUnique: async () => overrides.document ?? {
        id: "doc-a",
        storageKey: "supabase/2026/fixture.pdf",
        entityType: "lead",
        entityId: "lead-a",
        uploadedById: user.id,
        fileName: "fixture.pdf",
        mimeType: "application/pdf",
      },
      findFirst: async () => overrides.metadataFindFirst?.() ?? null,
      delete: async () => overrides.deleteMetadata?.() ?? { id: "doc-a" },
    },
    auditLog: { create: recordAudit },
    $transaction: async (run: (tx: unknown) => Promise<unknown>) =>
      run({
        storedDocument: {
          delete: async () => overrides.deleteMetadata?.() ?? { id: "doc-a" },
        },
        auditLog: { create: recordAudit },
      }),
  } as unknown as PrismaService;
  const storage = {
    put: async () => ({
      key: "supabase/2026/fixture.pdf",
      fileName: "fixture.pdf",
      mimeType: "application/pdf",
      size: file.buffer.length,
    }),
    delete: async (key: string) => {
      storageCalls.push(`delete:${key}`);
      await overrides.storageDelete?.();
    },
    get: async (key: string) => {
      storageCalls.push(`get:${key}`);
      return overrides.storageGet ? overrides.storageGet() : file.buffer;
    },
    logCleanupFailure: (key: string) => storageCalls.push(`cleanup-pending:${key}`),
  } as unknown as StorageService;
  const controller = new DocumentsController(db, storage, new AuditService(db));
  return { controller, storageCalls, createArgs, auditRows };
}

test("document upload requires file content and the existing branch-authorized owner", async () => {
  const missingFile = setup();
  await assert.rejects(
    missingFile.controller.upload(undefined as never, { entityType: "lead", entityId: "lead-a" }, { user } as never),
    BadRequestException,
  );
  assert.deepEqual(missingFile.createArgs, []);

  const foreignBranch = setup({ leadBranchId: "branch-b" });
  await assert.rejects(
    foreignBranch.controller.upload(file, { entityType: "lead", entityId: "lead-a" }, { user } as never),
    (error: { status?: number }) => error.status === 404,
  );
  assert.deepEqual(foreignBranch.storageCalls, []);
  assert.deepEqual(foreignBranch.createArgs, []);
});

test("successful upload stores metadata without returning the private object key", async () => {
  const { controller, createArgs } = setup();
  const result = await controller.upload(
    file,
    { entityType: "lead", entityId: "lead-a" },
    { user } as never,
  );
  assert.equal((result as { id: string }).id, "doc-a");
  assert.equal("storageKey" in (result as object), false);
  assert.equal(
    (createArgs[0] as { data: { storageKey: string } }).data.storageKey,
    "supabase/2026/fixture.pdf",
  );
});

test("metadata failure compensates by deleting the uploaded private object", async () => {
  const originalError = new Error("Synthetic metadata failure");
  const setupResult = setup({
    metadataCreate: async () => {
      throw originalError;
    },
  });
  await assert.rejects(
    setupResult.controller.upload(
      file,
      { entityType: "lead", entityId: "lead-a" },
      { user } as never,
    ),
    (error: Error) => error === originalError,
  );
  assert.deepEqual(setupResult.storageCalls, ["delete:supabase/2026/fixture.pdf"]);
});

test("uncertain metadata writes are verified before storage compensation", async () => {
  const persisted = {
    id: "doc-a",
    fileName: "fixture.pdf",
    mimeType: "application/pdf",
    sizeBytes: file.buffer.length,
  };
  const committed = setup({
    metadataCreate: async () => {
      throw new Error("Synthetic lost response");
    },
    metadataFindFirst: async () => persisted,
  });
  assert.equal(
    await committed.controller.upload(
      file,
      { entityType: "lead", entityId: "lead-a" },
      { user } as never,
    ),
    persisted,
  );
  assert.deepEqual(committed.storageCalls, []);

  const unverifiable = setup({
    metadataCreate: async () => {
      throw new Error("Synthetic database failure");
    },
    metadataFindFirst: async () => {
      throw new Error("Synthetic read failure");
    },
  });
  await assert.rejects(
    unverifiable.controller.upload(
      file,
      { entityType: "lead", entityId: "lead-a" },
      { user } as never,
    ),
    (error: Error) =>
      error instanceof ServiceUnavailableException &&
      error.message.includes("reconciliation requires operator attention"),
  );
  assert.deepEqual(unverifiable.storageCalls, []);
});

test("failed compensation returns an explicit operator-recovery error", async () => {
  const result = setup({
    metadataCreate: async () => {
      throw new Error("Synthetic database failure");
    },
    storageDelete: async () => {
      throw new Error("Synthetic object failure");
    },
  });
  await assert.rejects(
    result.controller.upload(
      file,
      { entityType: "lead", entityId: "lead-a" },
      { user } as never,
    ),
    (error: Error) =>
      error instanceof ServiceUnavailableException &&
      error.message.includes("operator attention"),
  );
  assert.deepEqual(result.storageCalls, [
    "delete:supabase/2026/fixture.pdf",
    "cleanup-pending:supabase/2026/fixture.pdf",
  ]);
});

test("download rechecks document owner permission and branch before reading object", async () => {
  const foreignBranch = setup({ leadBranchId: "branch-b" });
  const response = {
    headers: {} as Record<string, string>,
    body: undefined as Buffer | undefined,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    send(value: Buffer) {
      this.body = value;
    },
    status() {
      return this;
    },
  };
  await assert.rejects(
    foreignBranch.controller.download("doc-a", response as never, { user } as never),
    (error: { status?: number }) => error.status === 404,
  );
  assert.deepEqual(foreignBranch.storageCalls, []);

  const authorized = setup();
  await authorized.controller.download("doc-a", response as never, { user } as never);
  assert.deepEqual(authorized.storageCalls, ["get:supabase/2026/fixture.pdf"]);
  assert.equal(response.headers["Cache-Control"], "private, no-store");
  assert.equal(response.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(response.headers["Content-Disposition"], 'attachment; filename="fixture.pdf"');
});

test("deletion checks owner scope and reports object cleanup failures after metadata removal", async () => {
  const foreignBranch = setup({ leadBranchId: "branch-b" });
  await assert.rejects(
    foreignBranch.controller.delete("doc-a", { user } as never),
    (error: { status?: number }) => error.status === 404,
  );
  assert.deepEqual(foreignBranch.storageCalls, []);

  const cleanupFailure = setup({
    storageDelete: async () => {
      throw new Error("Synthetic storage failure");
    },
  });
  await assert.rejects(
    cleanupFailure.controller.delete("doc-a", { user } as never),
    (error: Error) =>
      error instanceof ServiceUnavailableException &&
      error.message.includes("cleanup requires operator attention"),
  );
  assert.deepEqual(cleanupFailure.storageCalls, [
    "delete:supabase/2026/fixture.pdf",
    "cleanup-pending:supabase/2026/fixture.pdf",
  ]);
  assert.deepEqual(
    cleanupFailure.auditRows.map((row) => (row as { action: string }).action),
    ["document.delete"],
  );

  const deleted = setup();
  assert.deepEqual(
    await deleted.controller.delete("doc-a", { user, ip: "192.0.2.4" } as never),
    { ok: true },
  );
  assert.deepEqual(
    deleted.auditRows.map((row) => (row as { action: string }).action),
    ["document.delete", "document.storage_cleanup"],
  );
});

test("upload, download, and deletion keep distinct server permission requirements", () => {
  assert.equal(
    Reflect.getMetadata(PERMISSION_KEY, DocumentsController.prototype.upload),
    "document.create",
  );
  assert.equal(
    Reflect.getMetadata(PERMISSION_KEY, DocumentsController.prototype.download),
    "document.view",
  );
  assert.equal(
    Reflect.getMetadata(PERMISSION_KEY, DocumentsController.prototype.delete),
    "document.delete",
  );
});
