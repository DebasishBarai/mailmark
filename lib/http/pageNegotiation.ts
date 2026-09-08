/**
 * The decision the middleware makes for every page request: HTML, the Markdown
 * variant, a 406, or nothing to do with us.
 *
 * It lives here, apart from proxy.ts, because it is pure: given a method, a
 * path and an Accept header it returns what to serve, which is the part worth
 * testing.
 */

import {
  MARKDOWN_MEDIA_TYPE,
  PAGE_OFFERS,
  PLAIN_MEDIA_TYPE,
  negotiate,
} from "./accept";
import { normalizePath } from "../site/routes";

/** Header carrying the page the Markdown was asked for, set on the rewrite. */
export const PATH_HINT = "x-mailmark-markdown-path";

/** Header the /md route reads to choose between text/markdown and text/plain. */
export const CONTENT_TYPE_HINT = "x-mailmark-markdown-content-type";

const MARKDOWN_TYPES = new Set([MARKDOWN_MEDIA_TYPE, "text/x-markdown"]);

export interface PageRequest {
  method: string;
  pathname: string;
  accept: string | null;
  /** True for the signed-in app routes, which are never content-negotiated. */
  isProtected: boolean;
  /** True for Next's own RSC and prefetch requests. */
  isReactRouterRequest: boolean;
  host: string | null;
}

export type PageDecision =
  /** Not a public page request: leave it alone. */
  | { kind: "passthrough" }
  /** Serve the HTML page, and say the response varies by Accept. */
  | { kind: "html"; path: string; route: boolean }
  /** Rewrite to the Markdown variant of `path`. */
  | { kind: "markdown"; path: string; contentType: string }
  /** The client accepts nothing this URL can produce. */
  | { kind: "notAcceptable"; path: string };

/** Paths that are never content-negotiated: they are not public pages. */
export function isNegotiablePath(pathname: string): boolean {
  if (pathname.startsWith("/api/")) return false;
  if (pathname === "/md" || pathname.startsWith("/md/")) return false;
  if (pathname.startsWith("/_next")) return false;
  // Anything that names a file (sitemap.xml, llms.txt, openapi.json) is served
  // as itself; only the ".md" alias of a page is handled here.
  const last = pathname.split("/").pop() ?? "";
  if (last.includes(".") && !last.toLowerCase().endsWith(".md")) return false;
  return true;
}

/** The internal path that serves the Markdown variant of `path`. */
export function markdownRewritePath(path: string): string {
  const normalized = normalizePath(path);
  return `/md${normalized === "/" ? "" : normalized}`;
}

export function decidePageResponse(request: PageRequest): PageDecision {
  const isRead = request.method === "GET" || request.method === "HEAD";

  if (
    !isRead ||
    request.isProtected ||
    request.isReactRouterRequest ||
    request.host === "api.mailmark.dev" ||
    !isNegotiablePath(request.pathname)
  ) {
    return { kind: "passthrough" };
  }

  // A ".md" suffix is an explicit request for the Markdown variant and needs no
  // Accept header at all. The home page has no name to hang the suffix on, so
  // "/index.md" is its alias.
  if (request.pathname.toLowerCase().endsWith(".md")) {
    const stripped = normalizePath(request.pathname.slice(0, -3));
    return {
      kind: "markdown",
      path: stripped === "/index" ? "/" : stripped,
      contentType: MARKDOWN_MEDIA_TYPE,
    };
  }

  const path = normalizePath(request.pathname);
  const { mediaType, notAcceptable } = negotiate(request.accept, PAGE_OFFERS);

  if (notAcceptable) return { kind: "notAcceptable", path };

  if (mediaType && (MARKDOWN_TYPES.has(mediaType) || mediaType === PLAIN_MEDIA_TYPE)) {
    return {
      kind: "markdown",
      path,
      contentType: mediaType === PLAIN_MEDIA_TYPE ? PLAIN_MEDIA_TYPE : MARKDOWN_MEDIA_TYPE,
    };
  }

  return { kind: "html", path, route: true };
}
