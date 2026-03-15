import type { NextConfig } from "next";

const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL!;

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      // beforeFiles runs before Next.js checks its own pages/filesystem,
      // so api.mailmark.dev traffic is always proxied to Convex — never the UI.
      beforeFiles: [
        {
          source: "/:path*",
          has: [{ type: "host", value: "api.mailmark.dev" }],
          destination: `${CONVEX_SITE_URL}/:path*`,
        },
      ],
    };
  },

  async headers() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "api.mailmark.dev" }],
        headers: [
          { key: "Access-Control-Allow-Origin", value: "https://www.mailmark.dev" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PATCH, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type" },
        ],
      },
    ];
  },
};

export default nextConfig;
