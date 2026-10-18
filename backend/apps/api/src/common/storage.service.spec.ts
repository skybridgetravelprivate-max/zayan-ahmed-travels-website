import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StorageService } from "./storage.service";

const ENV_KEYS = [
  "NODE_ENV",
  "DOCUMENT_UPLOADS_ENABLED",
  "STORAGE_DRIVER",
  "LOCAL_STORAGE_PATH",
  "SUPABASE_URL",
  "SUPABASE_STORAGE_BUCKET",
  "SUPABASE_SERVICE_ROLE_KEY",
];

async function withEnvironment(
  values: Record<string, string | undefined>,
  run: () => Promise<void>,
) {
  const previous = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) {
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  try {
    await run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function configureFetch(handler: typeof fetch) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = original;
  };
}

const pdf = Buffer.from("%PDF-1.7\nfixture\n");

test("uploads remain disabled unless the explicit flag is true", async () => {
  await withEnvironment({ NODE_ENV: "development", DOCUMENT_UPLOADS_ENABLED: undefined }, async () => {
    const storage = new StorageService();
    await assert.rejects(storage.put(Buffer.from("fixture"), "fixture.txt", "text/plain"), /temporarily unavailable/);
  });
});

test("production refuses local disk even when uploads are explicitly enabled", async () => {
  await withEnvironment({
    NODE_ENV: "production",
    DOCUMENT_UPLOADS_ENABLED: "true",
    STORAGE_DRIVER: "local",
  }, async () => {
    await assert.rejects(
      new StorageService().put(Buffer.from("fixture"), "fixture.txt", "text/plain"),
      /not configured/,
    );
  });
});

test("local development storage validates text content and keeps legacy downloads readable", async () => {
  const root = await mkdtemp(join(tmpdir(), "zat-storage-test-"));
  try {
    await withEnvironment({
      NODE_ENV: "test",
      DOCUMENT_UPLOADS_ENABLED: "true",
      STORAGE_DRIVER: "local",
      LOCAL_STORAGE_PATH: root,
    }, async () => {
      await writeFile(join(root, "existing.txt"), "legacy");
      const storage = new StorageService();
      assert.equal((await storage.get("existing.txt")).toString(), "legacy");
      const result = await storage.put(
        Buffer.from("fixture text\n"),
        "C:\\fakepath\\safe fixture.TXT",
        "text/plain",
      );
      assert.match(result.key, /^\d{4}\/[0-9a-f-]{36}\.txt$/);
      assert.equal(result.fileName, "safe_fixture.txt");
      assert.equal((await storage.get(result.key)).toString(), "fixture text\n");
      await storage.delete(result.key);
      await assert.rejects(readFile(join(root, result.key)));
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Supabase storage uses a private object API and never returns a public URL", async () => {
  const calls: { url: string; method: string; headers: Headers; body: BodyInit | null }[] = [];
  const restoreFetch = configureFetch(async (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: init?.body ?? null,
    });
    if (String(input).includes("/storage/v1/bucket/")) {
      return new Response(JSON.stringify({ public: false }), { status: 200 });
    }
    if (init?.method === "GET") return new Response(pdf, { status: 200 });
    return new Response("{}", { status: 200 });
  });
  try {
    await withEnvironment({
      NODE_ENV: "production",
      DOCUMENT_UPLOADS_ENABLED: "true",
      STORAGE_DRIVER: "supabase",
      SUPABASE_URL: "https://project-ref.supabase.co",
      SUPABASE_STORAGE_BUCKET: "zat-private-documents",
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-server-only-key",
    }, async () => {
      const storage = new StorageService();
      const result = await storage.put(
        pdf,
        "C:\\fakepath\\passport-copy.PDF",
        "application/pdf",
      );
      assert.match(result.key, /^supabase\/\d{4}\/[0-9a-f-]{36}\.pdf$/);
      assert.equal(result.fileName, "passport-copy.pdf");
      assert.equal("url" in result, false);
      assert.deepEqual(calls.map((call) => call.method), ["GET", "POST"]);
      assert.equal(calls[0].url, "https://project-ref.supabase.co/storage/v1/bucket/zat-private-documents");
      assert.equal(calls[0].headers.get("apikey"), "synthetic-server-only-key");
      assert.equal(calls[1].url, `https://project-ref.supabase.co/storage/v1/object/zat-private-documents/${result.key.slice("supabase/".length)}`);
      assert.ok(calls[0].headers.get("authorization"));
      assert.equal(calls[1].headers.get("apikey"), "synthetic-server-only-key");
      assert.equal(calls[1].headers.get("x-upsert"), "false");
      assert.equal(calls[1].headers.get("content-type"), "application/pdf");
      assert.equal(calls[1].headers.get("cache-control"), "no-store");
      assert.equal(await storage.get(result.key).then((data) => data.toString()), pdf.toString());
      await storage.delete(result.key);
      assert.deepEqual(calls.map((call) => call.method), [
        "GET",
        "POST",
        "GET",
        "GET",
        "GET",
        "DELETE",
      ]);
      assert.equal(
        calls[5].url,
        "https://project-ref.supabase.co/storage/v1/object/zat-private-documents",
      );
      assert.equal(JSON.parse(String(calls[5].body)).prefixes[0], result.key.slice("supabase/".length));
      assert.equal(calls.some((call) => call.url.includes("/object/public/")), false);
    });
  } finally {
    restoreFetch();
  }
});

test("public Supabase buckets are rejected before upload, download, or deletion", async () => {
  const calls: string[] = [];
  const restoreFetch = configureFetch(async (input) => {
    calls.push(String(input));
    return new Response(JSON.stringify({ public: true }), { status: 200 });
  });
  try {
    await withEnvironment({
      NODE_ENV: "production",
      DOCUMENT_UPLOADS_ENABLED: "true",
      STORAGE_DRIVER: "supabase",
      SUPABASE_URL: "https://project-ref.supabase.co",
      SUPABASE_STORAGE_BUCKET: "zat-private-documents",
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-server-only-key",
    }, async () => {
      const storage = new StorageService();
      await assert.rejects(storage.put(pdf, "fixture.pdf", "application/pdf"), /bucket is not private/);
      await assert.rejects(storage.get("supabase/2026/fixture.pdf"), /bucket is not private/);
      await assert.rejects(storage.delete("supabase/2026/fixture.pdf"), /bucket is not private/);
      assert.equal(calls.length, 3);
      assert.ok(calls.every((url) => url.endsWith("/storage/v1/bucket/zat-private-documents")));
    });
  } finally {
    restoreFetch();
  }
});

test("failed Supabase uploads attempt to remove the generated key and report uncertain cleanup", async () => {
  const methods: string[] = [];
  const restoreFetch = configureFetch(async (input, init) => {
    methods.push(init?.method ?? "GET");
    if (String(input).includes("/storage/v1/bucket/")) {
      return new Response(JSON.stringify({ public: false }), { status: 200 });
    }
    return new Response("synthetic failure", { status: 503 });
  });
  try {
    await withEnvironment({
      NODE_ENV: "production",
      DOCUMENT_UPLOADS_ENABLED: "true",
      STORAGE_DRIVER: "supabase",
      SUPABASE_URL: "https://project-ref.supabase.co",
      SUPABASE_STORAGE_BUCKET: "zat-private-documents",
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-server-only-key",
    }, async () => {
      await assert.rejects(
        new StorageService().put(pdf, "fixture.pdf", "application/pdf"),
        (error: Error) =>
          error.message.includes("cleanup requires operator attention") &&
          !error.message.includes("synthetic-server-only-key"),
      );
      assert.deepEqual(methods, ["GET", "POST", "DELETE"]);
    });
  } finally {
    restoreFetch();
  }
});

test("content type, magic bytes, extension and file size are independently validated", async () => {
  const root = await mkdtemp(join(tmpdir(), "zat-storage-test-"));
  try {
    await withEnvironment({
      NODE_ENV: "test",
      DOCUMENT_UPLOADS_ENABLED: "true",
      STORAGE_DRIVER: "local",
      LOCAL_STORAGE_PATH: root,
    }, async () => {
      const storage = new StorageService();
      await assert.rejects(storage.put(Buffer.from("not a pdf"), "fake.pdf", "application/pdf"), /content type/);
      await assert.rejects(storage.put(pdf, "fake.txt", "application/pdf"), /extension/);
      await assert.rejects(storage.put(Buffer.alloc(0), "empty.pdf", "application/pdf"), /Empty file/);
      const oversized = Buffer.concat([pdf, Buffer.alloc(8 * 1024 * 1024)]);
      await assert.rejects(storage.put(oversized, "large.pdf", "application/pdf"), /8 MB or smaller/);
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Supabase configuration and remote failures fail closed without revealing credentials", async () => {
  let remoteCalls = 0;
  const restoreFetch = configureFetch(async () => {
    remoteCalls += 1;
    return new Response(
      "secret-bearing server detail",
      { status: remoteCalls === 1 ? 403 : 200 },
    );
  });
  try {
    await withEnvironment({
      NODE_ENV: "production",
      DOCUMENT_UPLOADS_ENABLED: "true",
      STORAGE_DRIVER: "supabase",
      SUPABASE_URL: "http://remote.example.test",
      SUPABASE_STORAGE_BUCKET: "zat-private-documents",
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-server-only-key",
    }, async () => {
      await assert.rejects(
        new StorageService().put(pdf, "fixture.pdf", "application/pdf"),
        (error: Error) =>
          error.message.includes("not configured") &&
          !error.message.includes("synthetic-server-only-key"),
      );
    });
    await withEnvironment({
      NODE_ENV: "production",
      DOCUMENT_UPLOADS_ENABLED: "true",
      STORAGE_DRIVER: "supabase",
      SUPABASE_URL: "https://project-ref.supabase.co",
      SUPABASE_STORAGE_BUCKET: "zat-private-documents",
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-server-only-key",
    }, async () => {
      await assert.rejects(
        new StorageService().put(pdf, "fixture.pdf", "application/pdf"),
        (error: Error) =>
          error.message.includes("HTTP 403") &&
          !error.message.includes("secret-bearing") &&
          !error.message.includes("synthetic-server-only-key"),
      );
    });
  } finally {
    restoreFetch();
  }
});

test("invalid or traversing object keys never reach storage", async () => {
  let fetchCalls = 0;
  const restoreFetch = configureFetch(async () => {
    fetchCalls += 1;
    return new Response(pdf);
  });
  try {
    await withEnvironment({
      NODE_ENV: "production",
      DOCUMENT_UPLOADS_ENABLED: "true",
      STORAGE_DRIVER: "supabase",
      SUPABASE_URL: "https://project-ref.supabase.co",
      SUPABASE_STORAGE_BUCKET: "zat-private-documents",
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-server-only-key",
    }, async () => {
      await assert.rejects(new StorageService().get("supabase/../outside.pdf"), /Invalid storage key/);
      await assert.rejects(new StorageService().delete("supabase/%2e%2e/outside.pdf"), /Invalid storage key/);
      assert.equal(fetchCalls, 0);
    });
  } finally {
    restoreFetch();
  }
});
