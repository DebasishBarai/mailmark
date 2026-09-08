import { NextRequest, NextResponse } from "next/server";
import { apiError } from "../../../lib/http/apiError";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    // Old shape: NextResponse.json({ error: "..." }, { status }).
    return apiError({
      code: "invalid_request",
      message: "Missing url parameter",
      hint: "Call this endpoint as /api/fetch-csv?url=<absolute URL of a public CSV or Google Sheet>.",
      details: { required: ["url"] },
    });
  }

  let fetchUrl = url.trim();

  // Convert any Google Sheets URL to a CSV export URL
  // Handle published sheets: /spreadsheets/d/e/PUBLISHED_ID/pubhtml
  const pubMatch = fetchUrl.match(/docs\.google\.com\/spreadsheets\/d\/e\/([a-zA-Z0-9_-]+)/);
  // Handle regular sheets: /spreadsheets/d/SHEET_ID/edit
  const sheetsMatch = !pubMatch && fetchUrl.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const gidMatch = fetchUrl.match(/[?&#]gid=(\d+)/);
  const gid = gidMatch ? `&gid=${gidMatch[1]}` : "";

  if (pubMatch) {
    const pubId = pubMatch[1];
    fetchUrl = `https://docs.google.com/spreadsheets/d/e/${pubId}/pub?output=csv${gid}`;
  } else if (sheetsMatch) {
    const id = sheetsMatch[1];
    fetchUrl = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv${gid}`;
  }
  const isGoogleSheet = !!(pubMatch || sheetsMatch);

  try {
    const res = await fetch(fetchUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      redirect: "follow",
    });
    if (!res.ok) {
      const hint = isGoogleSheet
        ? '. Make sure the Google Sheet is shared as "Anyone with the link" or published to the web'
        : "";
      return apiError({
        code: "upstream_error",
        message: `Upstream responded with ${res.status}${hint}`,
        hint: isGoogleSheet
          ? 'Share the Google Sheet as "Anyone with the link", or publish it to the web, then retry.'
          : "Check that the URL is publicly reachable and returns CSV.",
        details: { upstreamStatus: res.status },
      });
    }
    // Google may return an HTML login page instead of CSV for non-public sheets
    const contentType = res.headers.get("content-type") || "";
    if (isGoogleSheet && contentType.includes("text/html")) {
      return apiError({
        code: "upstream_error",
        message: 'The Google Sheet is not publicly accessible. Share it as "Anyone with the link"',
        hint: "Google returned its sign-in page instead of CSV. Change the sheet's sharing setting and retry.",
      });
    }
    const text = await res.text();
    return new NextResponse(text, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch {
    return apiError({
      code: "upstream_error",
      message: "Failed to fetch the URL",
      hint: "The URL could not be reached. Check that it is public and retry.",
    });
  }
}
