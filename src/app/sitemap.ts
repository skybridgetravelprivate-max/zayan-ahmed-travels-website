import type { MetadataRoute } from "next";
import { allowSearchIndexing, navItems, policyLinks, siteOrigin } from "@/config/site";

const staticPaths = [
  ...navItems.filter((item) => item.href !== "/account" && !item.href.startsWith("/admin")).map((item) => item.href),
  ...policyLinks.map((item) => item.href),
];


export default function sitemap(): MetadataRoute.Sitemap {
  if (!allowSearchIndexing()) return [];

  const origin = siteOrigin();
  const paths = [...new Set(staticPaths)];

  return paths.map((path) => ({
    url: new URL(path, origin).href,
  }));
}
