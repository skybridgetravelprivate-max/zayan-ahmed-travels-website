import { defaultWebsiteSettings } from "@/config/website";
import { getWebsitePage } from "@/server/website-content";
import { connection } from "next/server";
import { companyContact, site } from "@/config/site";
import { crmPublicOrigin } from "@/server/crm-public";

export type PublicCompanyProfile = {
  companyName: string;
  phone: string;
  phones?: string[];
  email: string;
  website: string;
  address: string;
  whatsapp: string;
};

function staticProfile(): PublicCompanyProfile {
  return {
    companyName: site.legalName,
    phone: defaultWebsiteSettings.phones[0],
    phones: defaultWebsiteSettings.phones,
    email: companyContact.email,
    website: companyContact.website,
    address: companyContact.address,
    whatsapp: defaultWebsiteSettings.whatsapp,
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
    phones: remote.phone
      ? [
          remote.phone,
          ...defaultWebsiteSettings.phones.filter((p) => p !== remote.phone),
        ]
      : fallback.phones,
    email: remote.email || fallback.email,
    website: remote.website || fallback.website,
    address: remote.address || fallback.address,
    whatsapp: remote.whatsapp || fallback.whatsapp,
  };
}

/** Reads the public company profile. Staff credentials are not used. */
export async function getPublicCompanyProfile(): Promise<PublicCompanyProfile> {
  await connection();
  const settings = (await getWebsitePage("site-settings"))?.content.settings;
  if (settings)
    return {
      companyName: settings.companyName,
      phone: settings.phones[0] || "",
      phones: settings.phones,
      email: settings.email,
      website: site.url,
      address: settings.address,
      whatsapp: settings.whatsapp,
    };
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
