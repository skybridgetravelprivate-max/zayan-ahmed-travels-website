import type { WebsiteSettings } from "@/lib/website-content";
import { site, siteDescription, siteOrigin } from "@/config/site";

export type Crumb = {
  label: string;
  href?: string;
};

export function absoluteUrl(path: string) {
  return new URL(path, siteOrigin()).href;
}

/** Organization and WebSite data from the configured public identity only. */
export function siteGraph(settings?: WebsiteSettings) {
  const name = settings?.companyName || site.legalName;
  const description = settings?.seoDescription || siteDescription;
  const url = absoluteUrl("/");
  const organization = {
    "@type": "TravelAgency",
    "@id": `${url}#agency`,
    name,
    alternateName: site.shortName,
    url,
    description,
    ...(settings?.address ? { address: settings.address } : {}),
    ...(settings?.phones[0] ? { telephone: settings.phones[0] } : {}),
    ...(settings?.email ? { email: settings.email } : {}),
  };

  return {
    "@context": "https://schema.org",
    "@graph": [
      organization,
      {
        "@type": "WebSite",
        name,
        alternateName: site.shortName,
        url,
        description,
        publisher: {
          "@id": `${url}#agency`,
        },
      },
    ],
  };
}

export function breadcrumbList(items: readonly Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  };
}

export function jsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
