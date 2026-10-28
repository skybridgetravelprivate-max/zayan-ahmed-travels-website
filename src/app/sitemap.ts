import { getWebsitePages } from "@/server/website-content";
import type { MetadataRoute } from "next";
import {
  allowSearchIndexing,
  navItems,
  policyLinks,
  siteOrigin,
} from "@/config/site";

const staticPaths = [
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
  const published = await getWebsitePages();
  const builtin = new Set<string>(staticPaths);
  const paths = [
    ...new Set([
      ...staticPaths,
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
