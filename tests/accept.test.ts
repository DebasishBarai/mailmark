import { describe, expect, test } from "bun:test";
import {
  HTML_MEDIA_TYPE,
  MARKDOWN_MEDIA_TYPE,
  PAGE_OFFERS,
  PLAIN_MEDIA_TYPE,
  negotiate,
  parseAccept,
  prefersMarkdown,
  qualityFor,
} from "../lib/http/accept";

describe("parseAccept", () => {
  test("an absent or empty header means anything is acceptable", () => {
    for (const header of [null, undefined, "", "   "]) {
      expect(parseAccept(header)).toEqual([
        { type: "*", subtype: "*", q: 1, index: 0 },
      ]);
    }
  });

  test("reads q-values and defaults them to 1", () => {
    const ranges = parseAccept("text/html;q=0.8, text/markdown");
    expect(ranges[0]).toMatchObject({ type: "text", subtype: "html", q: 0.8 });
    expect(ranges[1]).toMatchObject({ type: "text", subtype: "markdown", q: 1 });
  });

  test("ignores a malformed q rather than treating it as a rejection", () => {
    expect(qualityFor(HTML_MEDIA_TYPE, parseAccept("text/html;q=banana"))).toBe(1);
  });

  test("clamps q to the 0..1 range and lowercases types", () => {
    expect(qualityFor("TEXT/HTML", parseAccept("TEXT/HTML;q=7"))).toBe(1);
    expect(qualityFor(HTML_MEDIA_TYPE, parseAccept("text/html;q=-3"))).toBe(0);
  });

  test("a header of only junk falls back to the wildcard", () => {
    expect(parseAccept("garbage")).toEqual([
      { type: "*", subtype: "*", q: 1, index: 0 },
    ]);
  });
});

describe("qualityFor", () => {
  test("the most specific matching range wins", () => {
    const ranges = parseAccept("*/*;q=0.2, text/*;q=0.5, text/markdown;q=0.9");
    expect(qualityFor(MARKDOWN_MEDIA_TYPE, ranges)).toBe(0.9);
    expect(qualityFor("text/plain", ranges)).toBe(0.5);
    expect(qualityFor("application/json", ranges)).toBe(0.2);
  });

  test("an unmatched type has quality zero", () => {
    expect(qualityFor("application/pdf", parseAccept("text/html"))).toBe(0);
  });
});

describe("negotiate", () => {
  test("a wildcard gets HTML, because HTML is the server's preference", () => {
    expect(negotiate("*/*").mediaType).toBe(HTML_MEDIA_TYPE);
    expect(negotiate(null).mediaType).toBe(HTML_MEDIA_TYPE);
  });

  test("a browser Accept header gets HTML", () => {
    const browser =
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";
    expect(negotiate(browser).mediaType).toBe(HTML_MEDIA_TYPE);
  });

  test("an explicit markdown request gets markdown", () => {
    expect(negotiate("text/markdown").mediaType).toBe(MARKDOWN_MEDIA_TYPE);
    expect(negotiate("text/x-markdown").mediaType).toBe("text/x-markdown");
  });

  test("q-values decide when both are on offer", () => {
    expect(negotiate("text/html;q=0.4, text/markdown;q=0.9").mediaType).toBe(
      MARKDOWN_MEDIA_TYPE
    );
    expect(negotiate("text/html, text/markdown;q=0.5").mediaType).toBe(
      HTML_MEDIA_TYPE
    );
  });

  test("q=0 rejects a type outright", () => {
    expect(negotiate("text/html;q=0, text/markdown").mediaType).toBe(
      MARKDOWN_MEDIA_TYPE
    );
  });

  test("text/plain is served as itself", () => {
    expect(negotiate("text/plain").mediaType).toBe(PLAIN_MEDIA_TYPE);
  });

  test("nothing on offer is acceptable", () => {
    const result = negotiate("application/pdf");
    expect(result.mediaType).toBeNull();
    expect(result.notAcceptable).toBe(true);
  });

  test("a wildcard is never not-acceptable", () => {
    expect(negotiate("application/pdf, */*;q=0.1").notAcceptable).toBe(false);
  });

  test("every offer is one this site can actually produce", () => {
    expect(PAGE_OFFERS).toContain(HTML_MEDIA_TYPE);
    expect(PAGE_OFFERS).toContain(MARKDOWN_MEDIA_TYPE);
    expect(PAGE_OFFERS.indexOf(HTML_MEDIA_TYPE)).toBeLessThan(
      PAGE_OFFERS.indexOf(MARKDOWN_MEDIA_TYPE)
    );
  });
});

describe("prefersMarkdown", () => {
  test("only when markdown outranks HTML", () => {
    expect(prefersMarkdown("text/markdown")).toBe(true);
    expect(prefersMarkdown("text/markdown, text/html;q=0.5")).toBe(true);
    expect(prefersMarkdown("*/*")).toBe(false);
    expect(prefersMarkdown("text/html")).toBe(false);
    expect(prefersMarkdown(null)).toBe(false);
    expect(prefersMarkdown("application/json")).toBe(false);
  });
});
