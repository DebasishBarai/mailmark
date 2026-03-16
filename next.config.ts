import type { NextConfig } from "next";

// Suppress benign ECONNRESET errors that occur when the browser closes a
// connection while Next.js dev server is still compiling (e.g. large Remotion files).
// Without this, Node logs an uncaughtException and can exit the dev process.
process.on("uncaughtException", (err: NodeJS.ErrnoException) => {
  if (err.code === "ECONNRESET" || (err as Error).message === "aborted") return;
  throw err;
});

const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL!;

const nextConfig: NextConfig = {
  transpilePackages: ["remotion", "@remotion/player", "@remotion/cli"],
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
