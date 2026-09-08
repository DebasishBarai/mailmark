import { describe, expect, test } from "bun:test";
import {
  ALL_ROUTES,
  BASE_URL,
  BLOG_ROUTES,
  findRoute,
  routesInSection,
} from "../lib/site/routes";
import { articles } from "../app/blog/[slug]/articles";
import sitemap from "../app/sitemap";
import robots from "../app/robots";

describe("the route registry", () => {
  test("paths are unique", () => {
    const paths = ALL_ROUTES.map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  test("paths are rooted and carry no trailing slash", () => {
    for (const route of ALL_ROUTES) {
      expect(route.path.startsWith("/")).toBe(true);
      if (route.path !== "/") expect(route.path.endsWith("/")).toBe(false);
    }
  });

  test("every route has a title and a description", () => {
    for (const route of ALL_ROUTES) {
      expect(route.title.length).toBeGreaterThan(0);
      expect(route.description.length).toBeGreaterThan(0);
    }
  });

  test("blog routes come from the article registry", () => {
    expect(BLOG_ROUTES.length).toBe(Object.keys(articles).length);
    for (const slug of Object.keys(articles)) {
      expect(findRoute(`/blog/${slug}`)).toBeDefined();
    }
  });

  test("the documentation section holds every docs page", () => {
    const docs = routesInSection("Docs").map((route) => route.path);
    for (const path of [
      "/docs",
      "/docs/getting-started",
      "/docs/domain-setup",
      "/docs/mailboxes",
      "/docs/email-campaigns",
      "/docs/troubleshooting",
      "/docs/byo-aws",
      "/docs/warmup",
      "/docs/sequences",
      "/docs/api",
    ]) {
      expect(docs).toContain(path);
    }
  });
});

describe("sitemap", () => {
  const entries = sitemap();

  test("lists every route in the registry, and nothing else", () => {
    const urls = entries.map((entry) => entry.url).sort();
    const expected = ALL_ROUTES.map((route) =>
      route.path === "/" ? BASE_URL : `${BASE_URL}${route.path}`
    ).sort();
    expect(urls).toEqual(expected);
  });

  test("every URL is absolute and on www", () => {
    for (const entry of entries) {
      expect(entry.url.startsWith(`${BASE_URL}`)).toBe(true);
    }
  });

  test("the home page keeps the top priority", () => {
    expect(entries.find((entry) => entry.url === BASE_URL)?.priority).toBe(1.0);
  });
});

describe("robots", () => {
  const rules = robots();

  test("keeps the API private but lets the OpenAPI description through", () => {
    const allow = rules.rules as { allow?: string[]; disallow?: string[] };
    expect(allow.allow).toContain("/api/openapi.json");
    expect(allow.allow).toContain("/api/openapi.yaml");
    expect(allow.disallow).toContain("/api/");
  });

  test("points at the sitemap on the canonical host", () => {
    expect(rules.sitemap).toBe(`${BASE_URL}/sitemap.xml`);
    expect(rules.host).toBe(BASE_URL);
  });
});
