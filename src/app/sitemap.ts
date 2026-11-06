import { getWebsitePages } from "@/server/website-content";
import type { MetadataRoute } from "next";
import { getPublicUmrahPackages } from "@/server/crm-umrah";
import { guideCategories } from "@/config/travel-guide";
import {
  allowSearchIndexing,
  navItems,
  policyLinks,
  siteOrigin,
} from "@/config/site";

const staticPaths = [
  "/",
  "/get-free-quote",
  ...guideCategories.map((guide) => `/travel-guide/${guide.slug}`),
  ...navItems
    .filter(
      (item) => item.href !== "/account" && !item.href.startsWith("/admin"),
    )
    .map((item) => item.href),
  ...policyLinks.map((item) => item.href),
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!allowSearchIndexing()) return [];

  const origin = siteOrigin();
  const [published, packages] = await Promise.all([
    getWebsitePages(),
    getPublicUmrahPackages(),
  ]);
  const builtin = new Set<string>(staticPaths);
  const paths = [
    ...new Set([
      ...staticPaths,
      ...packages.map((p) => `/umrah/${encodeURIComponent(p.id)}`),
      ...published
        .filter((p) => p.slug !== "site-settings")
        .map((p) =>
          p.slug === "home"
            ? "/"
            : builtin.has(`/${p.slug}`)
              ? `/${p.slug}`
              : `/pages/${p.slug}`,
        ),
    ]),
  ];

  return paths.map((path) => ({
    url: new URL(path, origin).href,
  }));
}
