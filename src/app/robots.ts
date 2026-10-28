import type { MetadataRoute } from "next";
import { allowSearchIndexing, siteOrigin } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  if (!allowSearchIndexing()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin/", "/account", "/my-bookings"],
    },
    sitemap: new URL("/sitemap.xml", siteOrigin()).href,
  };
}
