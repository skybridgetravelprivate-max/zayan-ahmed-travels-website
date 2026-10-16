import "server-only";

/** Resolve the current process-local API first; fall back to the configured API for local setups. */
export function crmPublicOrigin() {
  const url =
    process.env.ZAT_INTERNAL_API_ORIGIN?.trim() ||
    process.env.CRM_API_URL?.trim() ||
    "";
  if (!url) return "";

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    if (parsed.username || parsed.password) return "";
    return parsed.origin;
  } catch {
    return "";
  }
}
