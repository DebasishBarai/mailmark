import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { MARKDOWN_MEDIA_TYPE, PAGE_OFFERS } from "./lib/http/accept";
import {
  CONTENT_TYPE_HINT,
  PATH_HINT,
  decidePageResponse,
  markdownRewritePath,
} from "./lib/http/pageNegotiation";
import { notAcceptableMarkdown } from "./lib/markdown";
import { findRoute } from "./lib/site/routes";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/domains(.*)",
  "/mailbox(.*)",
  "/admin(.*)",
]);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://www.mailmark.dev",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

/**
 * Next's own client-side navigations ask for a React payload, not a document.
 * They must never be answered with the Markdown variant.
 */
function isReactRouterRequest(req: NextRequest): boolean {
  return (
    req.headers.get("rsc") !== null ||
    req.headers.get("next-router-prefetch") !== null ||
    req.headers.get("next-router-state-tree") !== null
  );
}

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // Handle CORS preflight for api.mailmark.dev
  if (req.headers.get("host") === "api.mailmark.dev" && req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  // Public pages are served as HTML or as Markdown depending on Accept
  // (https://acceptmarkdown.com). The decision itself lives in
  // lib/http/pageNegotiation.ts; this only carries it out.
  const decision = decidePageResponse({
    method: req.method,
    pathname: req.nextUrl.pathname,
    accept: req.headers.get("accept"),
    isProtected: isProtectedRoute(req),
    isReactRouterRequest: isReactRouterRequest(req),
    host: req.headers.get("host"),
  });

  if (decision.kind === "notAcceptable") {
    // The client ruled out every representation this URL has. Say so in the one
    // media type that is always safe to read.
    return new NextResponse(notAcceptableMarkdown(decision.path, PAGE_OFFERS), {
      status: 406,
      headers: {
        "Content-Type": `${MARKDOWN_MEDIA_TYPE}; charset=utf-8`,
        Vary: "Accept, Accept-Encoding",
      },
    });
  }

  if (decision.kind === "markdown") {
    const target = req.nextUrl.clone();
    target.pathname = markdownRewritePath(decision.path);

    // The path travels as a request header because "/" rewrites to "/md",
    // which is otherwise indistinguishable from a request for the Markdown
    // index, and a route handler reading a rewritten request sees the original
    // URL rather than the rewrite target.
    const headers = new Headers(req.headers);
    headers.set(PATH_HINT, decision.path);
    headers.set(CONTENT_TYPE_HINT, decision.contentType);

    return NextResponse.rewrite(target, { request: { headers } });
  }

  if (decision.kind === "html") {
    const response = withVary(NextResponse.next());
    const route = findRoute(decision.path);
    if (route) {
      // Point agents at the Markdown variant of the page they just fetched.
      response.headers.append(
        "Link",
        `<${req.nextUrl.origin}${route.path === "/" ? "" : route.path}.md>; rel="alternate"; type="text/markdown"`
      );
    }
    return response;
  }

  return undefined;
});

/**
 * Adds Accept to Vary on a page response.
 *
 * append(), not set(), so nothing already on the response is lost. Note that
 * the rendered HTML response carries its own Vary for the RSC router and the
 * render pipeline writes that one last, so on `next start` it replaces this
 * header; the Vary rule in next.config.ts is what puts Accept on rendered
 * pages, applied by the hosting layer after the response is produced. This
 * covers the responses middleware answers itself.
 */
function withVary(response: NextResponse): NextResponse {
  response.headers.append("Vary", "Accept");
  return response;
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
