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
      // so api.mailmark.dev traffic is always proxied to Convex - never the UI.
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
          // RFC 8631: point API clients at the machine-readable description of
          // what they are talking to.
          {
            key: "Link",
            value: '<https://www.mailmark.dev/openapi.json>; rel="service-desc"; type="application/json"',
          },
        ],
      },
      {
        // Every public page is served as HTML or as Markdown depending on
        // Accept (https://acceptmarkdown.com), so the response varies by that
        // header: without it a CDN can hand cached HTML to an agent that asked
        // for Markdown, or the reverse.
        //
        // The RSC router headers are repeated here because this rule replaces
        // the Vary the framework writes rather than adding to it, and dropping
        // them would let a CDN serve a React payload as a document.
        source: "/:path*",
        headers: [
          {
            key: "Vary",
            value:
              "Accept, RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch, Accept-Encoding",
          },
        ],
      },
      {
        // The same pointer for the tool endpoints served from www.
        source: "/api/:path*",
        headers: [
          {
            key: "Link",
            value: '<https://www.mailmark.dev/openapi.json>; rel="service-desc"; type="application/json"',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
