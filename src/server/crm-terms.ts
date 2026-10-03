import { connection } from "next/server";
import { cache } from "react";
import { crmPublicOrigin } from "@/server/crm-public";

const TERMS_SLUG = "TERMS_SLUG_HERE";

export type PublishedTermsPage = {
  title: string;
  body: string;
};

function textField(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > max ? "" : trimmed;
}

function readPage(body: unknown): PublishedTermsPage | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const row = body as Record<string, unknown>;
  if (row.slug !== TERMS_SLUG || row.status !== "PUBLISHED") return null;
  const title = textField(row.title, 200);
  const pageBody = textField(row.body, 20000);
  if (!title || !pageBody) return null;
  return { title, body: pageBody };
}

/** Reads the published Terms page. Staff credentials are not used. */
export const getPublishedTermsPage = cache(async (): Promise<PublishedTermsPage | null> => {
  await connection();
  const origin = crmPublicOrigin();
  if (!origin) return null;

  try {
    const response = await fetch(`${origin}/api/public/pages/${encodeURIComponent(TERMS_SLUG)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    return readPage(await response.json());
  } catch {
    return null;
  }
});
