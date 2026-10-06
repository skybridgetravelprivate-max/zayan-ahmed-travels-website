import "server-only";

import { crmPublicOrigin } from "@/server/crm-public";
import { setCustomerCrmId } from "@/server/customer-db/repository";

function readInternalToken() {
  const token = process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN?.trim() ?? "";
  if (token.length < 32) return "";
  return token;
}

function readCrmId(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  const id = (body as { id?: unknown }).id;
  return typeof id === "string" ? id.trim() : "";
}

/**
 * Upsert Nest customer by email (S2S). Stores Nest id on the website customer row.
 * Failures are soft — callers decide whether to continue without a link.
 */
export async function linkWebsiteCustomerToCrm(input: {
  websiteCustomerId: string;
  email: string;
  displayName: string;
}): Promise<string | null> {
  const origin = crmPublicOrigin();
  const token = readInternalToken();
  if (!origin || !token) return null;

  const email = input.email.trim().toLowerCase();
  if (!email) return null;

  let response: Response;
  try {
    response = await fetch(new URL("/v1/customer/upsert-by-email", origin), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Zat-Internal-Token": token,
      },
      body: JSON.stringify({
        email,
        fullName: input.displayName.trim() || undefined,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return null;
  }

  const crmId = readCrmId(body);
  if (!crmId || crmId.length > 64) return null;

  try {
    setCustomerCrmId(input.websiteCustomerId, crmId);
  } catch {
    return null;
  }

  return crmId;
}
