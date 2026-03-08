import type { NextConfig } from "next";

const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL!;

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Proxy all requests to api.remindme.me → Convex HTTP backend.
      // The real Convex URL is kept server-side and never exposed to clients.
      {
        source: "/:path*",
        has: [{ type: "host", value: "api.remindme.me" }],
        destination: `${CONVEX_SITE_URL}/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "api.remindme.me" }],
        headers: [
          { key: "Access-Control-Allow-Origin", value: "https://www.remindme.me" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PATCH, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type" },
        ],
      },
    ];
  },
};

export default nextConfig;
