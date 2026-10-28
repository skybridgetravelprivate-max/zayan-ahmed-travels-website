import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { parseContent, type WebsiteContent } from "@/lib/website-content";
import { defaultWebsiteSettings } from "@/config/website";
export type PublishedWebsitePage = {
  slug: string;
  version: number;
  content: WebsiteContent;
};
function origin() {
  const u = new URL(
    process.env.API_URL || process.env.CRM_API_URL || "http://127.0.0.1:4000",
  );
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname);
  if (
    u.username ||
    u.password ||
    !(u.protocol === "https:" || (local && u.protocol === "http:"))
  )
    throw new Error("Invalid public API origin");
  return u.origin;
}
export const getWebsitePage = cache(
  async (slug: string): Promise<PublishedWebsitePage | null> => {
    await connection();
    if (!/^[a-z][a-z0-9-]{0,79}$/.test(slug)) return null;
    try {
      const r = await fetch(`${origin()}/api/public/website/pages/${slug}`, {
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) return null;
      const row = await r.json();
      if (row.slug !== slug || !Number.isSafeInteger(row.version)) return null;
      return { slug, version: row.version, content: parseContent(row.content) };
    } catch {
      return null;
    }
  },
);
export const getWebsitePages = cache(
  async (): Promise<PublishedWebsitePage[]> => {
    await connection();
    try {
      const r = await fetch(`${origin()}/api/public/website/pages`, {
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) return [];
      const rows = await r.json();
      if (!Array.isArray(rows)) return [];
      return rows
        .filter(
          (r) =>
            typeof r.slug === "string" &&
            /^[a-z][a-z0-9-]{0,79}$/.test(r.slug) &&
            Number.isSafeInteger(r.version),
        )
        .map((r) => ({
          slug: r.slug,
          version: r.version,
          content: parseContent(r.content),
        }));
    } catch {
      return [];
    }
  },
);
export async function getWebsiteSettings() {
  return (
    (await getWebsitePage("site-settings"))?.content.settings ||
    defaultWebsiteSettings
  );
}
