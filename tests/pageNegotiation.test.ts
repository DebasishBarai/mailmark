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

  test("a client that accepts nothing we have gets a 406", () => {
    expect(decidePageResponse(request({ accept: "application/json" })).kind).toBe(
      "notAcceptable"
    );
    expect(decidePageResponse(request({ accept: "application/pdf" })).kind).toBe(
      "notAcceptable"
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
