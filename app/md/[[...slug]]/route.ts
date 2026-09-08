/**
 * The Markdown representation of every public page.
 *
 * Three ways in, all landing here:
 *   - `Accept: text/markdown` on any public URL (the middleware rewrites it)
 *   - a `.md` suffix on any public URL (also rewritten)
 *   - /md/<path> directly
 *
 * See https://acceptmarkdown.com for the negotiation contract.
 */

import { NextResponse } from "next/server";
import {
  getMarkdownDocument,
  notFoundMarkdown,
  siteIndexMarkdown,
} from "../../../lib/markdown";
import { BASE_URL, normalizePath } from "../../../lib/site/routes";
import { MARKDOWN_MEDIA_TYPE, PLAIN_MEDIA_TYPE } from "../../../lib/http/accept";
import { CONTENT_TYPE_HINT, PATH_HINT } from "../../../lib/http/pageNegotiation";

function contentTypeFor(request: Request): string {
  const hint = request.headers.get(CONTENT_TYPE_HINT);
  const type = hint === PLAIN_MEDIA_TYPE ? PLAIN_MEDIA_TYPE : MARKDOWN_MEDIA_TYPE;
  return `${type}; charset=utf-8`;
}

function markdownResponse(
  body: string,
  request: Request,
  { status = 200, canonical }: { status?: number; canonical?: string } = {}
): NextResponse {
  const headers: Record<string, string> = {
    "Content-Type": contentTypeFor(request),
    // Without Accept in Vary a CDN can hand the cached HTML to an agent asking
    // for Markdown, or the reverse, depending on which variant landed first.
    Vary: "Accept, Accept-Encoding",
    "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  };

  if (canonical) headers.Link = `<${canonical}>; rel="canonical"`;

  return new NextResponse(body, { status, headers });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug?: string[] }> }
) {
  const { slug } = await params;
  // The middleware passes the original path in a header, because "/" cannot be
  // expressed in the slug: it would be indistinguishable from a request for
  // the index at /md.
  const requested = request.headers.get(PATH_HINT);
  const raw = requested ?? `/${(slug ?? []).join("/")}`;
  const path = normalizePath(raw.replace(/\.md$/i, ""));

  // /md on its own is the index of everything that has a Markdown variant.
  if (path === "/" && !requested) {
    const index = `# Mailmark - Markdown index

Every public page below is available as Markdown, either by sending
\`Accept: text/markdown\` to its canonical URL or by appending \`.md\` to it
(the home page's alias is \`/index.md\`).

Machine-readable entry points: [llms.txt](${BASE_URL}/llms.txt), [OpenAPI](${BASE_URL}/openapi.json), [sitemap](${BASE_URL}/sitemap.xml).

${siteIndexMarkdown()}`;
    return markdownResponse(index, request, { canonical: `${BASE_URL}/md` });
  }

  const doc = getMarkdownDocument(path);

  if (!doc) {
    return markdownResponse(notFoundMarkdown(path), request, { status: 404 });
  }

  return markdownResponse(doc.markdown, request, {
    canonical: doc.path === "/" ? BASE_URL : `${BASE_URL}${doc.path}`,
  });
}

export const HEAD = GET;
