import { connection } from "next/server";
import { companyContact, site } from "@/config/site";
import { crmPublicOrigin } from "@/server/crm-public";

export type PublicCompanyProfile = {
  companyName: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  whatsapp: string;
};

function staticProfile(): PublicCompanyProfile {
  return {
    companyName: site.legalName,
    phone: "",
    email: companyContact.email,
    website: companyContact.website,
    address: companyContact.address,
    whatsapp: "",
  };
}

function textField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readProfile(body: unknown): PublicCompanyProfile | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const row = body as Record<string, unknown>;
  const profile: PublicCompanyProfile = {
    companyName: textField(row.companyName),
    phone: textField(row.phone),
    email: textField(row.email),
    website: textField(row.website),
    address: textField(row.address),
    whatsapp: textField(row.whatsapp),
  };
  return Object.values(profile).some(Boolean) ? profile : null;
}

function merge(remote: PublicCompanyProfile): PublicCompanyProfile {
  const fallback = staticProfile();
  return {
    companyName: remote.companyName || fallback.companyName,
    phone: remote.phone || fallback.phone,
    email: remote.email || fallback.email,
    website: remote.website || fallback.website,
    address: remote.address || fallback.address,
    whatsapp: remote.whatsapp || fallback.whatsapp,
  };
}

/** Reads the public company profile. Staff credentials are not used. */
export async function getPublicCompanyProfile(): Promise<PublicCompanyProfile> {
  await connection();
  const origin = crmPublicOrigin();
  if (!origin) return staticProfile();

  try {
    const response = await fetch(`${origin}/api/public/company`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return staticProfile();
    const remote = readProfile(await response.json());
    return remote ? merge(remote) : staticProfile();
  } catch {
    return staticProfile();
  }
}
