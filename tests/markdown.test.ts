import { describe, expect, test } from "bun:test";
import {
  getMarkdownDocument,
  hasMarkdownBody,
  markdownPaths,
  notFoundMarkdown,
  siteIndexMarkdown,
} from "../lib/markdown";
import { ALL_ROUTES, BASE_URL, findRoute, normalizePath } from "../lib/site/routes";
import { articles } from "../app/blog/[slug]/articles";

describe("normalizePath", () => {
  test("trailing slashes and missing leading slashes are normalised away", () => {
    expect(normalizePath("/docs/")).toBe("/docs");
    expect(normalizePath("docs")).toBe("/docs");
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("")).toBe("/");
  });
});

describe("getMarkdownDocument", () => {
  test("every public route has a Markdown representation", () => {
    for (const route of ALL_ROUTES) {
      const doc = getMarkdownDocument(route.path);
      expect(doc, `no Markdown for ${route.path}`).not.toBeNull();
      expect(doc!.title).toBe(route.title);
    }
  });

  test("the document carries front matter naming its canonical source", () => {
    const doc = getMarkdownDocument("/docs/api")!;
    expect(doc.markdown.startsWith("---\n")).toBe(true);
    expect(doc.markdown).toContain('title: "API Reference"');
    expect(doc.markdown).toContain(`source: "${BASE_URL}/docs/api"`);
    expect(doc.markdown).toContain("# API Reference");
  });

  test("a trailing slash resolves to the same document", () => {
    expect(getMarkdownDocument("/docs/")!.path).toBe("/docs");
  });

  test("an unknown path has no document", () => {
    expect(getMarkdownDocument("/nope")).toBeNull();
    expect(getMarkdownDocument("/docs/nope")).toBeNull();
  });

  test("the home page is a document of its own, not the index", () => {
    const doc = getMarkdownDocument("/")!;
    expect(doc.path).toBe("/");
    expect(doc.markdown).toContain("# Mailmark");
    expect(doc.markdown).toContain("## Pricing");
  });

  test("blog posts are rendered from the article registry", () => {
    for (const [slug, article] of Object.entries(articles)) {
      const doc = getMarkdownDocument(`/blog/${slug}`)!;
      expect(doc.title).toBe(article.title);
      for (const section of article.sections) {
        expect(doc.markdown).toContain(`## ${section.heading}`);
      }
    }
  });

  test("legal pages fall back to a stub that points at the binding text", () => {
    for (const path of ["/privacy", "/terms", "/security"]) {
      expect(hasMarkdownBody(path)).toBe(false);
      const doc = getMarkdownDocument(path)!;
      expect(doc.markdown).toContain(`${BASE_URL}${path}`);
      expect(doc.markdown).toContain("not a substitute for it");
    }
  });

  test("the pages an agent is most likely to want are written out in full", () => {
    for (const path of ["/", "/docs", "/docs/api", "/docs/getting-started", "/tools"]) {
      expect(hasMarkdownBody(path), `${path} has only a stub`).toBe(true);
    }
  });

  test("internal links resolve to real routes", () => {
    const linkPattern = /\]\((\/[^)#\s]*)(?:#[^)\s]*)?\)/g;
    for (const path of markdownPaths()) {
      const doc = getMarkdownDocument(path)!;
      for (const [, href] of doc.markdown.matchAll(linkPattern)) {
        if (href.includes(".")) continue; // /llms.txt, /openapi.json and friends
        if (href === "/sign-up") continue; // Clerk route, not a content page
        expect(findRoute(href), `${path} links to unknown route ${href}`).toBeDefined();
      }
    }
  });
});

describe("notFoundMarkdown", () => {
  const body = notFoundMarkdown("/nope");

  test("names the path that was missed", () => {
    expect(body).toContain("`/nope`");
    expect(body).toContain("404");
  });

  test("gives an agent somewhere to go next", () => {
    expect(body).toContain(`${BASE_URL}/sitemap.xml`);
    expect(body).toContain(`${BASE_URL}/llms.txt`);
    expect(body).toContain(`${BASE_URL}/docs`);
    expect(body).toContain(`${BASE_URL}/openapi.json`);
  });

  test("explains how to ask for Markdown", () => {
    expect(body).toContain("Accept: text/markdown");
  });
});

describe("siteIndexMarkdown", () => {
  const index = siteIndexMarkdown();

  test("covers every section of the site", () => {
    for (const heading of [
      "## Product",
      "## Documentation",
      "## Guides",
      "## Free tools",
      "## Company",
      "## Legal",
    ]) {
      expect(index).toContain(heading);
    }
  });

  test("links are absolute, so they survive being read out of context", () => {
    expect(index).toContain(`(${BASE_URL}/docs)`);
    expect(index).not.toContain("](/docs)");
  });
});
