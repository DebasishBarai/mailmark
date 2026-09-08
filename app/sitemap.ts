import type { MetadataRoute } from "next";
import { ALL_ROUTES, BASE_URL } from "../lib/site/routes";

// Old: the route list (static pages plus a hard-coded blogSlugs array) lived
// here. It now comes from lib/site/routes.ts, which the Markdown variants and
// the 404 page read as well, so a new page cannot appear in one and not the
// others.
//
// const blogSlugs = [ ... ];
// const staticRoutes: MetadataRoute.Sitemap = [ { url: BASE_URL, ... }, ... ];

export default function sitemap(): MetadataRoute.Sitemap {
  return ALL_ROUTES.map((route) => ({
    url: route.path === "/" ? BASE_URL : `${BASE_URL}${route.path}`,
    priority: route.priority,
    changeFrequency: route.changeFrequency,
  }));
}
