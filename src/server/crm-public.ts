import "server-only";

export function parseCrmPublicOrigin(value: string) {
  if (!value.trim()) return "";

  try {
    const parsed = new URL(value);
    const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (parsed.username || parsed.password) return "";
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLoopback)) return "";
    return parsed.origin;
  } catch {
    return "";
  }
}

/** Shared public CRM origin. Staff credentials are not read. */
export function crmPublicOrigin() {
  return parseCrmPublicOrigin(process.env.CRM_API_URL?.trim() ?? "");
}
