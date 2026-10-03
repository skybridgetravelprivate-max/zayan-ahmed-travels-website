import { site, siteDescription, siteOrigin } from "@/config/site";

export type Crumb = {
  label: string;
  href?: string;
};

export function absoluteUrl(path: string) {
  return new URL(path, siteOrigin()).href;
}

/** Organization and WebSite data from the configured public identity only. */
export function siteGraph() {
  const url = absoluteUrl("/");
  const organization = {
    "@type": "Organization",
    name: site.legalName,
    alternateName: site.shortName,
    url,
    description: siteDescription,
  };

  return {
    "@context": "https://schema.org",
    "@graph": [
      organization,
      {
        "@type": "WebSite",
        name: site.legalName,
        alternateName: site.shortName,
        url,
        description: siteDescription,
        publisher: {
          "@type": "Organization",
          name: site.legalName,
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
