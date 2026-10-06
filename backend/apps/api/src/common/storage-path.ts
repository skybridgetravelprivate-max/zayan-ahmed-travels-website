import * as path from "path";

export function resolveSafeStoragePath(root: string, key: string) {
  if (!key || typeof key !== "string" || key.includes("\0") || key.includes("..") || path.isAbsolute(key)) {
    throw new Error("Invalid storage key");
  }
  const base = path.resolve(root);
  const full = path.resolve(base, key);
  const prefix = base.endsWith(path.sep) ? base : base + path.sep;
  if (full !== base && !full.startsWith(prefix)) {
    throw new Error("Invalid storage key");
  }
  return full;
}

export function safeDownloadName(name: string) {
  return path.basename(String(name || "file")).replace(/["\r\n\\]+/g, "_").slice(0, 180) || "file";
}
