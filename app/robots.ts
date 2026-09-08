import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // The machine-readable API description sits under /api, which is
      // otherwise disallowed; the more specific Allow rules win, so agents and
      // crawlers can still reach the spec.
      allow: ["/", "/api/openapi.json", "/api/openapi.yaml"],
      disallow: ["/api/", "/dashboard/", "/_next/"],
    },
    sitemap: "https://www.mailmark.dev/sitemap.xml",
    host: "https://www.mailmark.dev",
  };
}
