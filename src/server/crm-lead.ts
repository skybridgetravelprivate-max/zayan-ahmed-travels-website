import "server-only";
import type { InquiryInput } from "@/lib/inquiries";

type CrmConfig = {
  url: string;
  identifier: string;
  password: string;
};

export class CrmNotConfiguredError extends Error {
  constructor() {
    super("CRM lead creation is not configured.");
  }
}

export class CrmRequestError extends Error {
  constructor() {
    super("The inquiry could not be received.");
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null;

function readConfig(): CrmConfig | null {
  const url = process.env.CRM_API_URL?.trim() ?? "";
  const identifier = process.env.CRM_API_IDENTIFIER?.trim() ?? "";
  const password = process.env.CRM_API_PASSWORD ?? "";
  if (!url || !identifier || !password.trim()) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;

  return { url: parsed.origin, identifier, password };
}

function leadNotes(input: InquiryInput) {
  const parts: string[] = [];
  if (input.subject) {
    const label = input.type === "transport" ? "Transport or service type" : "Subject";
    parts.push(`${label}: ${input.subject}`);
  }
  if (input.company) parts.push(`Company: ${input.company}`);
  if (input.destination) {
    const label =
      input.type === "umrah"
        ? "Package or destination"
        : input.type === "visa"
          ? "Visa country or type"
          : input.type === "tour"
            ? "Destination or tour"
            : input.type === "transport"
              ? "Destination or pickup"
              : "Destination";
    parts.push(`${label}: ${input.destination}`);
  }
  if (input.travelDate) parts.push(`Travel date: ${input.travelDate}`);
  if (input.travellers) parts.push(`Travellers: ${input.travellers}`);
  parts.push(input.type === "corporate" ? `Request: ${input.message}` : input.message);
  return parts.join("\n\n");
}

function cookieValue(response: Response, name: string) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const rows = headers.getSetCookie?.() ?? [];
  const combined = rows.length > 0 ? rows : (response.headers.get("set-cookie") ?? "").split(/,(?=\s*[^;]+=)/);
  for (const row of combined) {
    const first = row.split(";")[0] ?? "";
    const eq = first.indexOf("=");
    if (eq === -1) continue;
    if (first.slice(0, eq).trim() !== name) continue;
    return decodeURIComponent(first.slice(eq + 1).trim());
  }
  return "";
}

function confirmedLead(body: unknown) {
  if (!body || typeof body !== "object") return false;
  const row = body as Record<string, unknown>;
  return typeof row.id === "string" && row.id.length > 0;
}

async function login(config: CrmConfig) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;

  const response = await fetch(`${config.url}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: config.identifier, password: config.password }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new CrmRequestError();

  const token = cookieValue(response, "access_token");
  if (!token) throw new CrmRequestError();
  cachedToken = { value: token, expiresAt: Date.now() + 14 * 60 * 1000 };
  return token;
}

async function postLead(config: CrmConfig, token: string, input: InquiryInput, key?: string) {
  return fetch(`${config.url}/api/v1/website/leads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(key && { "Idempotency-Key": key }),
    },
    body: JSON.stringify({
      fullName: input.name,
      mobile: input.phone,
      email: input.email,
      notes: leadNotes(input),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
}

/** Creates one CRM lead. Call this only from the website server, after validation. */
export async function createInquiryLead(input: InquiryInput, key?: string) {
  const internalToken = process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN?.trim() ?? "";
  const origin = process.env.CRM_API_URL?.trim();
  if (origin && internalToken.length >= 32) {
    try {
      const url = new URL(origin);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new CrmNotConfiguredError();
      const response = await fetch(new URL("/api/v1/website/inquiries", url.origin), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Zat-Internal-Token": internalToken, ...(key && { "Idempotency-Key": key }) },
        body: JSON.stringify({ fullName: input.name, mobile: input.phone, email: input.email, notes: leadNotes(input) }),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok || !confirmedLead(await response.json())) throw new CrmRequestError();
      return;
    } catch (error) {
      if (error instanceof CrmNotConfiguredError) throw error;
      throw new CrmRequestError();
    }
  }
  const config = readConfig();
  if (!config) throw new CrmNotConfiguredError();

  let token: string;
  try {
    token = await login(config);
  } catch (error) {
    cachedToken = null;
    if (error instanceof CrmRequestError) throw error;
    throw new CrmRequestError();
  }

  let response: Response;
  try {
    response = await postLead(config, token, input, key);
    if (response.status === 401) {
      cachedToken = null;
      token = await login(config);
      response = await postLead(config, token, input, key);
    }
  } catch (error) {
    cachedToken = null;
    if (error instanceof CrmRequestError) throw error;
    throw new CrmRequestError();
  }

  if (!response.ok) throw new CrmRequestError();

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new CrmRequestError();
  }
  if (!confirmedLead(body)) throw new CrmRequestError();
}
