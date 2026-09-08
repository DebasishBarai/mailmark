import { describe, expect, test } from "bun:test";
import {
  decidePageResponse,
  isNegotiablePath,
  markdownRewritePath,
  type PageRequest,
} from "../lib/http/pageNegotiation";

function request(overrides: Partial<PageRequest> = {}): PageRequest {
  return {
    method: "GET",
    pathname: "/docs",
    accept: null,
    isProtected: false,
    isReactRouterRequest: false,
    host: "www.mailmark.dev",
    ...overrides,
  };
}

describe("isNegotiablePath", () => {
  test("public pages are", () => {
    for (const path of ["/", "/docs", "/docs/api", "/blog/some-post", "/tools"]) {
      expect(isNegotiablePath(path)).toBe(true);
    }
  });

  test("the .md alias of a page is", () => {
    expect(isNegotiablePath("/docs/api.md")).toBe(true);
  });

  test("API routes, Next internals and the Markdown routes are not", () => {
    for (const path of ["/api/tools/validate-emails", "/_next/static/x", "/md", "/md/docs"]) {
      expect(isNegotiablePath(path)).toBe(false);
    }
  });

  test("the signed-in application is not", () => {
    for (const path of [
      "/dashboard",
      "/dashboard/anything",
      "/domains/abc123",
      "/mailbox/abc123",
      "/admin/domains",
      "/settings",
      "/developer",
      "/billing",
      "/warming",
      "/audience",
      "/affiliate",
      "/suppressions",
      "/unsubscribes",
      "/domain-health",
      "/sign-in",
      "/sign-up",
    ]) {
      expect(isNegotiablePath(path), `${path} must be passed through`).toBe(false);
    }
  });

  test("a route whose name merely starts with an app route's is still a page", () => {
    // "/affiliate-program" is a public page; "/affiliate" is the dashboard.
    expect(isNegotiablePath("/affiliate-program")).toBe(true);
  });

  test("the generated social images and icons are not", () => {
    for (const path of [
      "/blog/why-emails-land-in-spam/opengraph-image",
      "/blog/why-emails-land-in-spam/twitter-image",
      "/icon",
      "/apple-icon",
      "/manifest",
    ]) {
      expect(isNegotiablePath(path), `${path} must be passed through`).toBe(false);
    }
  });

  test("files served as themselves are not", () => {
    for (const path of ["/sitemap.xml", "/llms.txt", "/openapi.json", "/favicon.ico"]) {
      expect(isNegotiablePath(path)).toBe(false);
    }
  });
});

describe("markdownRewritePath", () => {
  test("maps a page path onto the /md route", () => {
    expect(markdownRewritePath("/")).toBe("/md");
    expect(markdownRewritePath("/docs")).toBe("/md/docs");
    expect(markdownRewritePath("/docs/api/")).toBe("/md/docs/api");
  });
});

describe("decidePageResponse", () => {
  test("a browser gets HTML", () => {
    const decision = decidePageResponse(
      request({ accept: "text/html,application/xhtml+xml,*/*;q=0.8" })
    );
    expect(decision.kind).toBe("html");
  });

  test("a wildcard Accept keeps getting HTML", () => {
    expect(decidePageResponse(request({ accept: "*/*" })).kind).toBe("html");
    expect(decidePageResponse(request({ accept: null })).kind).toBe("html");
  });

  test("an agent asking for markdown gets the Markdown variant", () => {
    const decision = decidePageResponse(request({ accept: "text/markdown" }));
    expect(decision).toEqual({
      kind: "markdown",
      path: "/docs",
      contentType: "text/markdown",
    });
  });

  test("text/plain is served as text/plain", () => {
    const decision = decidePageResponse(request({ accept: "text/plain" }));
    expect(decision).toMatchObject({ kind: "markdown", contentType: "text/plain" });
  });

  test("a .md suffix needs no Accept header", () => {
    const decision = decidePageResponse(request({ pathname: "/docs/api.md" }));
    expect(decision).toEqual({
      kind: "markdown",
      path: "/docs/api",
      contentType: "text/markdown",
    });
  });

  test("/index.md is the home page's Markdown alias", () => {
    expect(decidePageResponse(request({ pathname: "/index.md" }))).toEqual({
      kind: "markdown",
      path: "/",
      contentType: "text/markdown",
    });
  });

  test("the home page keeps its own path, not the index's", () => {
    const decision = decidePageResponse(request({ pathname: "/", accept: "text/markdown" }));
    expect(decision).toMatchObject({ kind: "markdown", path: "/" });
    expect(markdownRewritePath((decision as { path: string }).path)).toBe("/md");
  });

  test("a client that accepts nothing we have still gets the page", () => {
    // RFC 9110 section 12.5.1 lets a server disregard Accept and send the
    // default representation, and that is what a client asking a page for JSON
    // or PDF got before this negotiation existed. Refusing it with a 406 would
    // break, say, an uptime monitor configured with the wrong Accept header.
    for (const accept of ["application/json", "application/pdf", "image/png"]) {
      expect(decidePageResponse(request({ accept })).kind, accept).toBe("html");
    }
  });

  test("a URL that is not a published page is never touched", () => {
    // The regression this guards: a social crawler fetching a generated card
    // with `Accept: image/*`, and any app route asked for as JSON.
    for (const pathname of [
      "/blog/why-emails-land-in-spam/opengraph-image",
      "/settings",
      "/developer",
      "/this-page-does-not-exist",
    ]) {
      for (const accept of ["image/webp,image/*", "application/json", "application/pdf"]) {
        expect(
          decidePageResponse(request({ pathname, accept })).kind,
          `${accept} on ${pathname}`
        ).toBe("passthrough");
      }
    }
  });

  test("an unknown path is only rewritten when Markdown was asked for by name", () => {
    const unknown = { pathname: "/this-page-does-not-exist" };
    expect(decidePageResponse(request({ ...unknown, accept: "text/markdown" }))).toMatchObject({
      kind: "markdown",
      path: "/this-page-does-not-exist",
    });
    expect(decidePageResponse(request({ ...unknown, accept: "text/html" })).kind).toBe(
      "passthrough"
    );
    expect(decidePageResponse(request({ ...unknown, accept: "*/*" })).kind).toBe(
      "passthrough"
    );
  });

  test("writes, app routes, RSC requests and the API host are left alone", () => {
    expect(decidePageResponse(request({ method: "POST" })).kind).toBe("passthrough");
    expect(decidePageResponse(request({ isProtected: true })).kind).toBe("passthrough");
    expect(decidePageResponse(request({ isReactRouterRequest: true })).kind).toBe(
      "passthrough"
    );
    expect(decidePageResponse(request({ host: "api.mailmark.dev" })).kind).toBe(
      "passthrough"
    );
    expect(decidePageResponse(request({ pathname: "/api/ref" })).kind).toBe("passthrough");
    expect(
      decidePageResponse(request({ pathname: "/settings", accept: "text/markdown" })).kind
    ).toBe("passthrough");
  });

  test("HEAD is negotiated like GET", () => {
    expect(decidePageResponse(request({ method: "HEAD", accept: "text/markdown" })).kind).toBe(
      "markdown"
    );
  });

  test("a 406 is never returned to a client that would take anything", () => {
    expect(decidePageResponse(request({ accept: "application/json, */*;q=0.1" })).kind).toBe(
      "html"
    );
  });
});
