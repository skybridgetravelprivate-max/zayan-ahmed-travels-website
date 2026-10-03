/** Shared public CRM origin. Staff credentials are not read. */
export function crmPublicOrigin() {
  const url = process.env.CRM_API_URL?.trim() ?? "";
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
