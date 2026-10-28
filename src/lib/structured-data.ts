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
    "@type": "Organization",
    name,
    alternateName: site.shortName,
    url,
    description,
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
          "@type": "Organization",
          name,
          url,
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
