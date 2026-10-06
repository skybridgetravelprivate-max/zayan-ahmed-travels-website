import { BadRequestException, Injectable } from "@nestjs/common";
import * as fs from "fs/promises";
import * as path from "path";
import { randomUUID } from "crypto";
import { resolveSafeStoragePath } from "./storage-path";

const ALLOWED_MIME: Record<string, { ext: string[]; magic: number[][] }> = {
  "image/jpeg": { ext: [".jpg", ".jpeg"], magic: [[0xff, 0xd8, 0xff]] },
  "image/png": { ext: [".png"], magic: [[0x89, 0x50, 0x4e, 0x47]] },
  "image/webp": { ext: [".webp"], magic: [[0x52, 0x49, 0x46, 0x46]] },
  "application/pdf": { ext: [".pdf"], magic: [[0x25, 0x50, 0x44, 0x46]] },
  "text/plain": { ext: [".txt"], magic: [] },
};

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

function hasMagic(buffer: Buffer, patterns: number[][]) {
  if (!patterns.length) return true;
  return patterns.some((p) => p.every((b, i) => buffer[i] === b));
}

@Injectable()
export class StorageService {
  private driver = process.env.STORAGE_DRIVER ?? "local";
  private localRoot = process.env.LOCAL_STORAGE_PATH ?? "./uploads";

  private safeName(originalName: string) {
    const base = path.basename(String(originalName || "file")).replace(/[^\w.\-]+/g, "_");
    const ext = path.extname(base).toLowerCase();
    const stem = path.basename(base, ext).slice(0, 80) || "file";
    return { stem, ext };
  }

  private fullPath(key: string) {
    try {
      return resolveSafeStoragePath(this.localRoot, key);
    } catch {
      throw new BadRequestException("Invalid storage key");
    }
  }

  async put(buffer: Buffer, originalName: string, mimeType: string) {
    if (!buffer || buffer.length === 0) throw new BadRequestException("Empty file");
    if (buffer.length > MAX_UPLOAD_BYTES) throw new BadRequestException("File must be 8 MB or smaller");
    const mime = String(mimeType || "").toLowerCase();
    const spec = ALLOWED_MIME[mime];
    const { stem, ext } = this.safeName(originalName);
    if (!spec || !spec.ext.includes(ext)) {
      throw new BadRequestException("File type not allowed");
    }
    if (!hasMagic(buffer, spec.magic)) {
      throw new BadRequestException("File content does not match type");
    }
    const key = `${new Date().getFullYear()}/${randomUUID()}${ext}`;
    await this.putLocal(key, buffer);
    void this.driver;
    return { key, mimeType: mime, size: buffer.length, fileName: `${stem}${ext}` };
  }

  async get(key: string) {
    return fs.readFile(this.fullPath(key));
  }

  private async putLocal(key: string, buffer: Buffer) {
    const full = this.fullPath(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, buffer);
  }
}
