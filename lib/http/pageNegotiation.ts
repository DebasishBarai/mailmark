/**
 * The decision the middleware makes for every page request: HTML, the Markdown
 * variant, a 406, or nothing to do with us.
 *
 * It lives here, apart from proxy.ts, because it is pure: given a method, a
 * path and an Accept header it returns what to serve, which is the part worth
 * testing.
 *
 * The bias throughout is towards doing nothing. Only the public content pages
 * in lib/site/routes.ts are content-negotiated; every other request - the
 * signed-in app, the generated social images, anything unrecognised - is passed
 * through untouched, so a client asking for a media type we do not list can
 * never be refused a response it used to get.
 */

import {
  MARKDOWN_MEDIA_TYPE,
  PAGE_OFFERS,
  PLAIN_MEDIA_TYPE,
  negotiate,
} from "./accept";
import { findRoute, normalizePath } from "../site/routes";

/** Header carrying the page the Markdown was asked for, set on the rewrite. */
export const PATH_HINT = "x-mailmark-markdown-path";

/** Header the /md route reads to choose between text/markdown and text/plain. */
export const CONTENT_TYPE_HINT = "x-mailmark-markdown-content-type";

const MARKDOWN_TYPES = new Set([MARKDOWN_MEDIA_TYPE, "text/x-markdown"]);

/**
 * The signed-in application, which has no Markdown representation and must
 * never be answered with one. Some of these are behind the Clerk matcher and
 * some are only guarded client-side, so they are listed in full rather than
 * inferred from the auth rules.
 */
const APP_SHELL_PREFIXES = [
  "/dashboard",
  "/domains",
  "/mailbox",
  "/admin",
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
  "/user",
];

/**
 * Next.js generates these from files in the app directory. They are images and
 * manifests, and the crawlers that fetch them send Accept headers like
 * `image/*`, so they have to be out of negotiation entirely.
 */
const METADATA_SEGMENTS = new Set([
  "opengraph-image",
  "twitter-image",
  "icon",
  "apple-icon",
  "manifest",
]);

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
  | { kind: "html"; path: string }
  /** Rewrite to the Markdown variant of `path`. */
  | { kind: "markdown"; path: string; contentType: string }
  /** The client accepts nothing this URL can produce. */
  | { kind: "notAcceptable"; path: string };

/** Paths that are never content-negotiated: they are not public pages. */
export function isNegotiablePath(pathname: string): boolean {
  if (pathname.startsWith("/api/")) return false;
  if (pathname === "/md" || pathname.startsWith("/md/")) return false;
  if (pathname.startsWith("/_next")) return false;

  for (const prefix of APP_SHELL_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return false;
  }

  const last = pathname.split("/").pop() ?? "";
  // A generated image or manifest, whatever it sits under.
  if (METADATA_SEGMENTS.has(last)) return false;
  // Anything that names a file (sitemap.xml, llms.txt, openapi.json) is served
  // as itself; only the ".md" alias of a page is handled here.
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
  const isPublicPage = findRoute(path) !== undefined;

  if (mediaType && (MARKDOWN_TYPES.has(mediaType) || mediaType === PLAIN_MEDIA_TYPE)) {
    // Asked for by name, so this is safe on an unknown path too: it produces
    // the Markdown 404, which is the point.
    return {
      kind: "markdown",
      path,
      contentType: mediaType === PLAIN_MEDIA_TYPE ? PLAIN_MEDIA_TYPE : MARKDOWN_MEDIA_TYPE,
    };
  }

  // Everything below only applies to the pages we actually publish. Refusing a
  // request (406) or claiming a response varies by Accept is only true of a URL
  // that has both representations.
  if (!isPublicPage) return { kind: "passthrough" };

  if (notAcceptable) return { kind: "notAcceptable", path };

  return { kind: "html", path };
}
