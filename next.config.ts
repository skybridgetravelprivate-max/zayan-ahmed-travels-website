import type { NextConfig } from "next";

const privateNoStore = [
  {
    key: "Cache-Control",
    value: "private, no-cache, no-store, max-age=0, must-revalidate",
  },
];

function crmApiOrigin() {
  const configured = process.env.CRM_API_URL?.trim();
  if (!configured) return null;

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error("CRM_API_URL must be an absolute HTTP or HTTPS URL.");
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error("CRM_API_URL must use HTTP or HTTPS and must not contain credentials.");
  }

  return parsed.origin;
}

const nextConfig: NextConfig = {
  output: "standalone",
  // Shared hosting reports many CPUs, but cannot sustain that many build workers.
  experimental: { cpus: 2 },
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'" },
        ],
      },
      { source: "/reset-password", headers: [...privateNoStore, { key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/admin", headers: privateNoStore },
      { source: "/agent", headers: privateNoStore },
      { source: "/agent/:path*", headers: privateNoStore },
      { source: "/admin/:path*", headers: privateNoStore },
      { source: "/account", headers: privateNoStore },
      { source: "/my-bookings", headers: privateNoStore },
      { source: "/api/account/:path*", headers: privateNoStore },
    ];
  },
  async rewrites() {
    const origin = crmApiOrigin();
    if (!origin) return [];

    return [
      { source: "/api", destination: `${origin}/api` },
      { source: "/api/:path*", destination: `${origin}/api/:path*` },
    ];
  },
};

export default nextConfig;
