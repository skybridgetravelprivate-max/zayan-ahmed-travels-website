import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import * as fs from "fs/promises";
import * as path from "path";
import { randomUUID } from "crypto";
import { resolveSafeStoragePath } from "./storage-path";

const ACCEPTED_FILES: Record<string, { extension: string; signature: (data: Buffer) => boolean }> = {
  "image/jpeg": {
    extension: ".jpg",
    signature: (data) => data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff,
  },
  "image/png": {
    extension: ".png",
    signature: (data) =>
      data.length >= 8 &&
      data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  "image/webp": {
    extension: ".webp",
    signature: (data) =>
      data.length >= 12 &&
      data.toString("ascii", 0, 4) === "RIFF" &&
      data.toString("ascii", 8, 12) === "WEBP",
  },
  "application/pdf": {
    extension: ".pdf",
    signature: (data) => data.length >= 5 && data.toString("ascii", 0, 5) === "%PDF-",
  },
  "text/plain": {
    extension: ".txt",
    signature: (data) => {
      try {
        const decoded = new TextDecoder("utf-8", { fatal: true }).decode(data);
        return !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(decoded);
      } catch {
        return false;
      }
    },
  },
};

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const PRIVATE_KEY_PREFIX = "supabase/";
const BUCKET_NAME = /^[a-z0-9][a-z0-9._-]{2,62}$/;

function validateKey(key: string) {
  if (
    typeof key !== "string" ||
    key.length > 180 ||
    key.includes("\\") ||
    key.includes("\0") ||
    key.split("/").some((part) => {
      if (!part || part === "." || part === "..") return true;
      try {
        const decoded = decodeURIComponent(part);
        return (
          decoded === "." ||
          decoded === ".." ||
          /[\/\\\0]/.test(decoded)
        );
      } catch {
        return true;
      }
    })
  ) {
    throw new BadRequestException("Invalid storage key");
  }
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly localRoot = process.env.LOCAL_STORAGE_PATH ?? "./uploads";

  private safeName(originalName: string, extension: string) {
    const normalized = String(originalName || "file").replace(/\\/g, "/");
    const base = path.posix.basename(normalized).replace(/[^\w.\-]+/g, "_");
    const originalExtension = path.posix.extname(base).toLowerCase();
    if (originalExtension !== extension && !(extension === ".jpg" && originalExtension === ".jpeg")) {
      throw new BadRequestException("File extension does not match file content");
    }
    const stem = (originalExtension ? base.slice(0, -originalExtension.length) : base)
      .slice(0, 80) || "file";
    return `${stem}${extension}`;
  }

  private localPath(key: string) {
    try {
      return resolveSafeStoragePath(this.localRoot, key);
    } catch {
      throw new BadRequestException("Invalid storage key");
    }
  }

  private supabaseConfig() {
    const rawUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET;
    if (!rawUrl || !serviceKey || !bucket || !BUCKET_NAME.test(bucket)) {
      throw new ServiceUnavailableException("Private document storage is not configured.");
    }
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new ServiceUnavailableException("Private document storage is not configured.");
    }
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    ) {
      throw new ServiceUnavailableException("Private document storage is not configured.");
    }
    return { origin: url.origin, serviceKey, bucket };
  }

  private supabasePath(key: string) {
    validateKey(key);
    const config = this.supabaseConfig();
    const objectPath = key
      .slice(PRIVATE_KEY_PREFIX.length)
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    const bucketPath = `${config.origin}/storage/v1/object/${encodeURIComponent(config.bucket)}`;
    return {
      ...config,
      bucketUrl: bucketPath,
      url: `${bucketPath}/${objectPath}`,
    };
  }

  private async supabaseRequest(
    method: "GET" | "POST" | "DELETE",
    key: string,
    body?: Buffer,
    mimeType?: string,
  ) {
    const target = this.supabasePath(key);
    const response = await fetch(method === "DELETE" ? target.bucketUrl : target.url, {
      method,
      headers: {
        apikey: target.serviceKey,
        Authorization: `Bearer ${target.serviceKey}`,
        ...(body
          ? {
              "Content-Type": mimeType ?? "application/octet-stream",
              "Cache-Control": "no-store",
              "x-upsert": "false",
            }
          : {}),
        ...(method === "DELETE" ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body } : {}),
      ...(method === "DELETE"
        ? {
            body: JSON.stringify({
              prefixes: [key.slice(PRIVATE_KEY_PREFIX.length)],
            }),
          }
        : {}),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Private document storage request failed (HTTP ${response.status}).`,
      );
    }
    return response;
  }

  private async assertUploadsEnabled() {
    if (process.env.DOCUMENT_UPLOADS_ENABLED !== "true") {
      throw new ServiceUnavailableException("Document uploads are temporarily unavailable.");
    }
    const driver = process.env.STORAGE_DRIVER ?? "local";
    if (process.env.NODE_ENV === "production" && driver !== "supabase") {
      throw new ServiceUnavailableException("Private document storage is not configured.");
    }
    if (driver === "supabase") {
      this.supabaseConfig();
      return driver;
    }
    if (driver !== "local" || process.env.NODE_ENV === "production") {
      throw new ServiceUnavailableException("Private document storage is not configured.");
    }
    return driver;
  }

  async put(buffer: Buffer, originalName: string, mimeType: string) {
    const driver = await this.assertUploadsEnabled();
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new BadRequestException("Empty file");
    }
    if (buffer.length > MAX_UPLOAD_BYTES) {
      throw new BadRequestException("File must be 8 MB or smaller");
    }
    const mime = String(mimeType || "").toLowerCase();
    const file = ACCEPTED_FILES[mime];
    if (!file || !file.signature(buffer)) {
      throw new BadRequestException("File content type is not allowed or does not match.");
    }
    const fileName = this.safeName(originalName, file.extension);
    const key = driver === "supabase"
      ? `${PRIVATE_KEY_PREFIX}${new Date().getUTCFullYear()}/${randomUUID()}${file.extension}`
      : `${new Date().getUTCFullYear()}/${randomUUID()}${file.extension}`;

    if (driver === "supabase") {
      try {
        await this.supabaseRequest("POST", key, buffer, mime);
      } catch (uploadError) {
        try {
          await this.supabaseRequest("DELETE", key);
        } catch (cleanupError) {
          this.logCleanupFailure(key, cleanupError);
          throw new ServiceUnavailableException(
            "Document upload outcome is uncertain; storage cleanup requires operator attention.",
          );
        }
        throw uploadError;
      }
    } else {
      await this.putLocal(key, buffer);
    }
    return { key, mimeType: mime, size: buffer.length, fileName };
  }

  async get(key: string) {
    validateKey(key);
    if (key.startsWith(PRIVATE_KEY_PREFIX)) {
      const response = await this.supabaseRequest("GET", key);
      return Buffer.from(await response.arrayBuffer());
    }
    return fs.readFile(this.localPath(key));
  }

  async delete(key: string) {
    validateKey(key);
    if (key.startsWith(PRIVATE_KEY_PREFIX)) {
      await this.supabaseRequest("DELETE", key);
      return;
    }
    await fs.rm(this.localPath(key), { force: true });
  }

  logCleanupFailure(key: string, error: unknown) {
    const reason = error instanceof Error ? error.name : "UnknownError";
    this.logger.error(`Storage object cleanup is pending for key ${key} (${reason}).`);
  }

  private async putLocal(key: string, buffer: Buffer) {
    const full = this.localPath(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, buffer, { flag: "wx" });
  }
}
