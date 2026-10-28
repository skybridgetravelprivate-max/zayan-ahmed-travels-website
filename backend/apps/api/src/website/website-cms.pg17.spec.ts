import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID, createHash } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { WebsiteCmsService } from "./website-cms.service";
import {
  PublicWebsiteController,
  WebsiteMediaController,
} from "./website-media.controller";
import { AuditService } from "../common/audit.service";
import { StorageService } from "../common/storage.service";
import { DocumentsController } from "../documents/documents.controller";
import {
  parseContent,
  WebsiteContent,
} from "../../../../packages/config/website-content.cjs";
import type { AuthUser } from "../auth/auth.types";

const draft = (title: string): WebsiteContent => ({
  schemaVersion: 1,
  category: "page",
  title,
  summary: "Synthetic website content",
  body: "No real customer data.",
  eyebrow: "Synthetic",
  image: "",
  imageAlt: "",
  actionLabel: "",
  actionHref: "",
  sections: [],
});
test(
  "PG17 CMS publishing, isolation, concurrency, rollback and real media persistence",
  { skip: !process.env.ZAT_SYNTHETIC_DATABASE_URL },
  async (t) => {
    const url = new URL(process.env.ZAT_SYNTHETIC_DATABASE_URL!);
    assert.equal(url.hostname, "127.0.0.1");
    assert.equal(url.port, "55463");
    assert.equal(url.pathname, "/zat_synthetic_fullstack_20261028");
    const db = new PrismaClient({ datasourceUrl: url.href });
    const keys = [
      "NODE_ENV",
      "DOCUMENT_UPLOADS_ENABLED",
      "STORAGE_DRIVER",
      "LOCAL_STORAGE_PATH",
    ];
    const previous = new Map(keys.map((k) => [k, process.env[k]]));
    try {
      const [server] = await db.$queryRaw<
        { version: number }[]
      >`SELECT current_setting('server_version_num')::int AS version`;
      assert.ok(server.version >= 170000 && server.version < 180000);
      const staff = await db.user.create({
        data: {
          username: randomUUID(),
          email: `${randomUUID()}@example.test`,
          fullName: "Synthetic CMS editor",
          passwordHash: "invalid",
        },
      });
      const actor = {
        id: staff.id,
        isSuperAdmin: true,
        permissions: [],
        branchIds: [],
        defaultBranchId: null,
      } as unknown as AuthUser;
      const editor = {
        ...actor,
        isSuperAdmin: false,
        permissions: ["cms.view", "cms.edit"],
      };
      const stranger = { ...editor, permissions: [] };
      const audit = new AuditService(db as never),
        cms = new WebsiteCmsService(db as never, audit);
      const slug = `synthetic-${randomUUID()}`;
      let row = await cms.save(actor, slug, {
        version: 0,
        content: draft("First publication"),
      });
      await t.test(
        "draft read requires staff permission; public lookup and index exclude drafts",
        async () => {
          await assert.rejects(cms.read(stranger, slug), { status: 403 });
          await assert.rejects(cms.publicPage(slug), { status: 404 });
          assert.ok(!(await cms.publicPages()).some((p) => p.slug === slug));
          await assert.rejects(
            cms.transition(editor, slug, "publish", { version: row.version }),
            { status: 403 },
          );
          await assert.rejects(
            cms.transition(actor, slug, "publish", { version: row.version }),
            { status: 409 },
          );
        },
      );
      row = await cms.transition(editor, slug, "review", {
        version: row.version,
      });
      row = await cms.transition(actor, slug, "publish", {
        version: row.version,
      });
      const firstPublished = row.version;
      await t.test(
        "editing a published page retains its last public snapshot; edit invalidates review",
        async () => {
          row = await cms.save(editor, slug, {
            version: row.version,
            content: draft("Private changed title"),
          });
          assert.equal(
            (await cms.publicPage(slug)).content.title,
            "First publication",
          );
          assert.equal(row.title, "First publication");
          await assert.rejects(
            cms.transition(actor, slug, "publish", { version: row.version }),
            { status: 409 },
          );
        },
      );
      await t.test(
        "concurrent stale saves admit exactly one writer, with one audited revision",
        async () => {
          const before = row.version;
          const results = await Promise.allSettled([
            cms.save(editor, slug, {
              version: before,
              content: draft("Concurrent A"),
            }),
            cms.save(editor, slug, {
              version: before,
              content: draft("Concurrent B"),
            }),
          ]);
          assert.equal(
            results.filter((r) => r.status === "fulfilled").length,
            1,
          );
          assert.equal(
            results.filter(
              (r) =>
                r.status === "rejected" &&
                (r.reason as { status: number }).status === 409,
            ).length,
            1,
          );
          row = await db.cmsPage.findUniqueOrThrow({ where: { slug } });
          assert.equal(row.version, before + 1);
          assert.equal(
            await db.cmsPageRevision.count({
              where: { pageId: row.id, version: row.version },
            }),
            1,
          );
        },
      );
      await t.test(
        "audit failure rolls back content and revision together",
        async () => {
          const failing = new WebsiteCmsService(
            db as never,
            {
              log: async () => {
                throw new Error("Synthetic audit failure");
              },
            } as never,
          );
          const before = await db.cmsPageRevision.count({
            where: { pageId: row.id },
          });
          await assert.rejects(
            failing.save(editor, slug, {
              version: row.version,
              content: draft("Must roll back"),
            }),
          );
          assert.equal(
            (await db.cmsPage.findUniqueOrThrow({ where: { slug } })).version,
            row.version,
          );
          assert.equal(
            await db.cmsPageRevision.count({ where: { pageId: row.id } }),
            before,
          );
        },
      );
      await t.test(
        "revision restore is a draft; review/publish required, old versions reject",
        async () => {
          const old = row.version;
          row = await cms.transition(editor, slug, "rollback", {
            version: row.version,
            revision: firstPublished,
          });
          assert.equal(
            (row.draft as unknown as WebsiteContent).title,
            "First publication",
          );
          assert.equal(row.reviewState, "DRAFT");
          await assert.rejects(
            cms.transition(actor, slug, "review", { version: old }),
            { status: 409 },
          );
          row = await cms.transition(editor, slug, "review", {
            version: row.version,
          });
          row = await cms.transition(actor, slug, "publish", {
            version: row.version,
          });
          assert.equal((await cms.publicPage(slug)).version, row.version);
        },
      );
      await t.test(
        "unknown fields, dangerous links, remote images and HTML-like text stay bounded",
        async () => {
          assert.throws(() => parseContent({ ...draft("x"), unknown: "x" }));
          assert.throws(() =>
            parseContent({
              ...draft("x"),
              image: "https://example.test/track.jpg",
            }),
          );
          assert.throws(() =>
            parseContent({
              ...draft("x"),
              actionLabel: "Unsafe",
              actionHref: "javascript:alert(1)",
            }),
          );
          assert.throws(() =>
            parseContent({
              ...draft("x"),
              actionLabel: "Unsafe",
              actionHref: "/admin/users",
            }),
          );
          assert.equal(
            parseContent({
              ...draft("x"),
              body: '<img src=x onerror="alert(1)">',
            }).body,
            '<img src=x onerror="alert(1)">',
          ); // rendered as React text, never innerHTML
        },
      );
      Object.assign(process.env, {
        NODE_ENV: "test",
        DOCUMENT_UPLOADS_ENABLED: "true",
        STORAGE_DRIVER: "local",
        LOCAL_STORAGE_PATH: await mkdtemp(
          join(tmpdir(), "zat-synthetic-cms-media-"),
        ),
      });
      const storage = new StorageService(),
        documents = new DocumentsController(db as never, storage, audit),
        media = new WebsiteMediaController(db as never, storage, audit),
        publicApi = new PublicWebsiteController(cms, db as never, storage);
      const req = { user: actor } as never;
      const bytes = await sharp({
        create: { width: 320, height: 160, channels: 3, background: "#143d62" },
      })
        .jpeg()
        .withMetadata({
          exif: { IFD0: { Artist: "Synthetic private metadata" } },
        })
        .toBuffer();
      const file = {
        buffer: bytes,
        mimetype: "image/jpeg",
        originalname: "synthetic-public-art.jpg",
      } as Express.Multer.File;
      const doc = await documents.upload(
        file,
        { entityType: "cmsPage", entityId: row.id },
        req,
      );
      const image = await media.add(
        { documentId: doc.id, alt: "Synthetic navy rectangle" },
        req,
      );
      await t.test(
        "real images are re-encoded without metadata; draft-only images are not public",
        async () => {
          const saved = await db.storedDocument.findUniqueOrThrow({
            where: { id: doc.id },
          });
          assert.equal(saved.mimeType, "image/webp");
          const b = await storage.get(saved.storageKey);
          const metadata = await sharp(b).metadata();
          assert.equal(metadata.exif, undefined);
          assert.equal(metadata.width, 320);
          await assert.rejects(
            publicApi.media(image.id, { setHeader() {} } as never),
            { status: 404 },
          );
          const privateDoc = await db.storedDocument.create({
            data: {
              fileName: "private.jpg",
              mimeType: "image/jpeg",
              sizeBytes: 1,
              storageKey: "never-read",
              entityType: "customer",
              entityId: "synthetic-private",
            },
          });
          await assert.rejects(
            media.add({ documentId: privateDoc.id, alt: "No" }, req),
            { status: 404 },
          );
        },
      );
      await t.test(
        "publication gates image access; bytes persist across fresh storage objects; referenced deletion denied",
        async () => {
          row = await cms.save(actor, slug, {
            version: row.version,
            content: {
              ...draft("Artwork publication"),
              image: `/api/public/website/media/${image.id}`,
              imageAlt: "Synthetic navy rectangle",
            },
          });
          row = await cms.transition(actor, slug, "review", {
            version: row.version,
          });
          row = await cms.transition(actor, slug, "publish", {
            version: row.version,
          });
          let output: Buffer | undefined;
          const headers = new Map<string, string>();
          await publicApi.media(image.id, {
            setHeader(k: string, v: string) {
              headers.set(k.toLowerCase(), v);
            },
            send(b: Buffer) {
              output = b;
            },
          } as never);
          assert.equal(headers.get("cache-control"), "no-store");
          assert.equal(headers.get("x-content-type-options"), "nosniff");
          assert.ok(output);
          const saved = await db.storedDocument.findUniqueOrThrow({
            where: { id: doc.id },
          });
          assert.equal(
            createHash("sha256").update(output!).digest("hex"),
            createHash("sha256")
              .update(await new StorageService().get(saved.storageKey))
              .digest("hex"),
          );
          await assert.rejects(media.remove(image.id, req), { status: 400 });
          await assert.rejects(documents.delete(doc.id, req), { status: 400 });
        },
      );
      await t.test(
        "unpublish immediately denies public page and image; revision history retains artwork",
        async () => {
          row = await cms.transition(actor, slug, "unpublish", {
            version: row.version,
          });
          await assert.rejects(cms.publicPage(slug), { status: 404 });
          await assert.rejects(
            publicApi.media(image.id, { setHeader() {} } as never),
            { status: 404 },
          );
          await assert.rejects(media.remove(image.id, req), { status: 400 });
        },
      );
      await t.test(
        "disabled uploads and mislabeled SVG fail without new metadata",
        async () => {
          const before = await db.storedDocument.count();
          process.env.DOCUMENT_UPLOADS_ENABLED = "false";
          await assert.rejects(
            documents.upload(
              file,
              { entityType: "cmsPage", entityId: row.id },
              req,
            ),
            { status: 503 },
          );
          process.env.DOCUMENT_UPLOADS_ENABLED = "true";
          await assert.rejects(
            documents.upload(
              {
                ...file,
                buffer: Buffer.from(
                  '<svg xmlns="http://www.w3.org/2000/svg"/>',
                ),
              },
              { entityType: "cmsPage", entityId: row.id },
              req,
            ),
            { status: 400 },
          );
          assert.equal(await db.storedDocument.count(), before);
        },
      );
    } finally {
      for (const [key, v] of previous) {
        if (v === undefined) delete process.env[key];
        else process.env[key] = v;
      }
      await db.$disconnect();
    }
  },
);
