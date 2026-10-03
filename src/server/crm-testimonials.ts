import { connection } from "next/server";
import type { PublicTestimonial } from "@/lib/public-testimonials";
import { crmPublicOrigin } from "@/server/crm-public";

function textField(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function readTestimonial(row: unknown): PublicTestimonial | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const record = row as Record<string, unknown>;
  if (record.published !== true) return null;
  const id = textField(record.id, 80);
  const author = textField(record.author, 120);
  const quote = textField(record.quote, 600);
  if (!id || !author || !quote) return null;
  return { id, author, quote };
}

function readTestimonials(body: unknown) {
  if (!Array.isArray(body)) return [];
  return body.flatMap((row) => {
    const item = readTestimonial(row);
    return item ? [item] : [];
  });
}

/** Reads published testimonials. Staff credentials are not used. */
export async function getPublicTestimonials(): Promise<PublicTestimonial[]> {
  await connection();
  const origin = crmPublicOrigin();
  if (!origin) return [];

  try {
    const response = await fetch(`${origin}/api/public/testimonials`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];
    return readTestimonials(await response.json());
  } catch {
    return [];
  }
}
