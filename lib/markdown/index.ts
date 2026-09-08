/**
 * The Markdown representation of every public page.
 *
 * Agents that send `Accept: text/markdown` (see https://acceptmarkdown.com) are
 * routed here by the middleware, and the same bodies are reachable by adding a
 * `.md` suffix to any public URL.
 */

import { articles } from "../../app/blog/[slug]/articles";
import {
  ALL_ROUTES,
  BASE_URL,
  findRoute,
  normalizePath,
  routesInSection,
  type SiteRoute,
} from "../site/routes";
import { docsMarkdown } from "./pages/docs";
import { apiMarkdown } from "./pages/api";
import { guidesMarkdown } from "./pages/guides";
import { siteMarkdown } from "./pages/site";

export interface MarkdownDocument {
  path: string;
  title: string;
  description: string;
  /** The full document, front matter and all. */
  markdown: string;
}

/** Blog posts rendered from the same structured content the HTML page uses. */
function blogBody(slug: string): string {
  const article = articles[slug];
  const sections = article.sections
    .map(
      (section) =>
        `## ${section.heading}\n\n${section.content.join("\n\n")}`
    )
    .join("\n\n");

  return `${article.excerpt}\n\n${sections}\n\nCategory: ${article.category}. Published ${article.date}. ${article.readTime}.\n`;
}

const blogMarkdown: Record<string, string> = Object.fromEntries(
  Object.keys(articles).map((slug) => [`/blog/${slug}`, blogBody(slug)])
);

/** Hand-written and generated bodies, keyed by normalised path. */
const BODIES: Record<string, string> = {
  ...siteMarkdown,
  ...docsMarkdown,
  "/docs/api": apiMarkdown,
  ...guidesMarkdown,
  ...blogMarkdown,
};

function absolute(path: string): string {
  return path === "/" ? BASE_URL : `${BASE_URL}${path}`;
}

/**
 * The stub served for a public page that has no hand-written Markdown body.
 *
 * It says what the page is and where the authoritative text lives rather than
 * paraphrasing it, which is the right answer for the legal pages.
 */
function stubBody(route: SiteRoute): string {
  return `${route.description}\n\nThe text of this page is served as HTML at ${absolute(
    route.path
  )} and has no Markdown rendering. This note is not a substitute for it.\n\nOther entry points: [llms.txt](${BASE_URL}/llms.txt), [documentation](${BASE_URL}/docs), [sitemap](${BASE_URL}/sitemap.xml).\n`;
}

/** Front matter plus body, the shape every Markdown response takes. */
function render(route: SiteRoute, body: string): string {
  return `---
title: "${route.title.replace(/"/g, '\\"')}"
description: "${route.description.replace(/"/g, '\\"')}"
source: "${absolute(route.path)}"
site: "Mailmark"
---

# ${route.title}

${body.trim()}

---

Mailmark - email hosting and campaigns for your own domain. Canonical page: ${absolute(
    route.path
  )} | [llms.txt](${BASE_URL}/llms.txt) | [OpenAPI](${BASE_URL}/openapi.json) | [sitemap](${BASE_URL}/sitemap.xml)
`;
}

/** The Markdown document for a public path, or null when the path is unknown. */
export function getMarkdownDocument(pathname: string): MarkdownDocument | null {
  const path = normalizePath(pathname);
  const route = findRoute(path);
  if (!route) return null;

  const body = BODIES[path] ?? stubBody(route);

  return {
    path,
    title: route.title,
    description: route.description,
    markdown: render(route, body),
  };
}

/** True when a path has a hand-written body rather than the generated stub. */
export function hasMarkdownBody(pathname: string): boolean {
  return normalizePath(pathname) in BODIES;
}

function sectionList(heading: string, routes: SiteRoute[]): string {
  if (routes.length === 0) return "";
  const items = routes
    .map((route) => `- [${route.title}](${absolute(route.path)})`)
    .join("\n");
  return `## ${heading}\n\n${items}\n`;
}

/** A compact map of the site, used by the 404 body and the /md index. */
export function siteIndexMarkdown(): string {
  return [
    sectionList("Product", routesInSection("Product")),
    sectionList("Documentation", routesInSection("Docs")),
    sectionList("Guides", routesInSection("Guides")),
    sectionList("Free tools", routesInSection("Tools")),
    sectionList("Company", routesInSection("Company")),
    sectionList("Legal", routesInSection("Legal")),
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * The body of a 404. Agents get a real 404 status and, in it, enough to find
 * their way to the page they actually wanted.
 */
export function notFoundMarkdown(pathname: string): string {
  const path = normalizePath(pathname);

  return `# 404 - Page not found

\`${path}\` does not exist on ${BASE_URL}.

## Where to look next

- [Sitemap](${BASE_URL}/sitemap.xml) - every public URL on this site
- [llms.txt](${BASE_URL}/llms.txt) - the full product description in one file
- [Documentation](${BASE_URL}/docs) - setup, mailboxes, campaigns, API
- [API reference](${BASE_URL}/docs/api) and [OpenAPI description](${BASE_URL}/openapi.json)
- [Free tools](${BASE_URL}/tools)
- [Blog](${BASE_URL}/blog)

Any page on this site is available as Markdown: send \`Accept: text/markdown\`, or append \`.md\` to the URL.

${siteIndexMarkdown()}
`;
}

/** Paths that have a Markdown representation. Used by tests and the index. */
export function markdownPaths(): string[] {
  return ALL_ROUTES.map((route) => route.path);
}
