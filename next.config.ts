import type { NextConfig } from "next";

const privateNoStore = [
  {
    key: "Cache-Control",
    value: "private, no-cache, no-store, max-age=0, must-revalidate",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/*": [
      "./backend/apps/api/dist/**/*",
      "./backend/node_modules/**/*",
      "./backend/packages/config/**/*",
    ],
  },
  async headers() {
    return [
      { source: "/account", headers: privateNoStore },
      { source: "/my-bookings", headers: privateNoStore },
      { source: "/api/account/:path*", headers: privateNoStore },
    ];
  },
};

export default nextConfig;
