/**
 * Accept-header parsing and proactive content negotiation (RFC 9110 section 12.5.1).
 *
 * Used by the middleware to decide whether a request for a public page should
 * be answered with HTML (browsers) or with the Markdown variant of the same
 * URL (agents), per https://acceptmarkdown.com.
 */

export interface MediaRange {
  /** Type part of the range, lowercased. "*" for a wildcard. */
  type: string;
  /** Subtype part of the range, lowercased. "*" for a wildcard. */
  subtype: string;
  /** Quality value, 0..1. Defaults to 1 when absent or unparsable. */
  q: number;
  /** Position in the header, used to keep parsing stable for equal ranges. */
  index: number;
}

/** Media types this site can serve for a public page, in server preference order. */
export const HTML_MEDIA_TYPE = "text/html";
export const MARKDOWN_MEDIA_TYPE = "text/markdown";
export const PLAIN_MEDIA_TYPE = "text/plain";

/**
 * Every representation a public page can be served as. Order matters: it is
 * the server's own preference and breaks ties between equally acceptable
 * offers, so HTML stays the default for anything that does not ask otherwise.
 */
export const PAGE_OFFERS = [
  HTML_MEDIA_TYPE,
  "application/xhtml+xml",
  MARKDOWN_MEDIA_TYPE,
  "text/x-markdown",
  PLAIN_MEDIA_TYPE,
] as const;

const MARKDOWN_TYPES = new Set([MARKDOWN_MEDIA_TYPE, "text/x-markdown"]);

/** Parses an Accept header into media ranges. An empty header means `*​/*`. */
export function parseAccept(header: string | null | undefined): MediaRange[] {
  if (!header || !header.trim()) {
    return [{ type: "*", subtype: "*", q: 1, index: 0 }];
  }

  const ranges: MediaRange[] = [];
  const parts = header.split(",");

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    const [rawType, ...params] = part.split(";");
    const slash = rawType.indexOf("/");
    if (slash === -1) continue;

    const type = rawType.slice(0, slash).trim().toLowerCase();
    const subtype = rawType.slice(slash + 1).trim().toLowerCase();
    if (!type || !subtype) continue;

    let q = 1;
    for (const param of params) {
      const eq = param.indexOf("=");
      if (eq === -1) continue;
      if (param.slice(0, eq).trim().toLowerCase() !== "q") continue;
      const parsed = Number.parseFloat(param.slice(eq + 1).trim());
      // A malformed q is ignored rather than treated as a rejection, so a
      // sloppy header never turns into a 406 for a client that would have
      // been happy with the default representation.
      if (Number.isFinite(parsed)) q = Math.min(Math.max(parsed, 0), 1);
    }

    ranges.push({ type, subtype, q, index: i });
  }

  if (ranges.length === 0) {
    return [{ type: "*", subtype: "*", q: 1, index: 0 }];
  }

  return ranges;
}

/** Specificity of a media range, highest wins when several match one offer. */
function specificity(range: MediaRange): number {
  if (range.type === "*") return 0;
  if (range.subtype === "*") return 1;
  return 2;
}

/**
 * The quality the client assigned to `mediaType`, using the most specific
 * matching range. Returns 0 when the type is not acceptable at all.
 */
export function qualityFor(mediaType: string, ranges: MediaRange[]): number {
  const slash = mediaType.indexOf("/");
  const type = mediaType.slice(0, slash).toLowerCase();
  const subtype = mediaType.slice(slash + 1).toLowerCase();

  let best: MediaRange | null = null;
  for (const range of ranges) {
    const typeMatches = range.type === "*" || range.type === type;
    const subtypeMatches = range.subtype === "*" || range.subtype === subtype;
    if (!typeMatches || !subtypeMatches) continue;
    if (!best || specificity(range) > specificity(best)) best = range;
  }

  return best ? best.q : 0;
}

export interface NegotiationResult {
  /** The chosen media type, or null when nothing on offer is acceptable. */
  mediaType: string | null;
  /** True when the client explicitly excluded every representation we have. */
  notAcceptable: boolean;
}

/**
 * Picks the best representation for an Accept header.
 *
 * Ties go to the earlier entry in `offers` (server preference), which keeps
 * HTML the answer for `Accept: * / *` and for browsers that list HTML and
 * markdown at the same quality.
 */
export function negotiate(
  header: string | null | undefined,
  offers: readonly string[] = PAGE_OFFERS
): NegotiationResult {
  const ranges = parseAccept(header);

  let bestType: string | null = null;
  let bestQuality = 0;

  for (const offer of offers) {
    const q = qualityFor(offer, ranges);
    if (q > bestQuality) {
      bestQuality = q;
      bestType = offer;
    }
  }

  return { mediaType: bestType, notAcceptable: bestType === null };
}

/**
 * True when the client prefers a Markdown representation over HTML for a page.
 *
 * Deliberately strict: a request has to rank markdown *above* HTML, so
 * `Accept: * / *` (curl, most crawlers, link unfurlers) keeps getting the HTML
 * page it has always got.
 */
export function prefersMarkdown(header: string | null | undefined): boolean {
  const result = negotiate(header);
  return result.mediaType !== null && MARKDOWN_TYPES.has(result.mediaType);
}
