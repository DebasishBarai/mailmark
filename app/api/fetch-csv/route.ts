import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
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
      return NextResponse.json(
        { error: `Upstream responded with ${res.status}${hint}` },
        { status: 502 },
      );
    }
    // Google may return an HTML login page instead of CSV for non-public sheets
    const contentType = res.headers.get("content-type") || "";
    if (isGoogleSheet && contentType.includes("text/html")) {
      return NextResponse.json(
        { error: 'The Google Sheet is not publicly accessible. Share it as "Anyone with the link"' },
        { status: 502 },
      );
    }
    const text = await res.text();
    return new NextResponse(text, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch the URL" }, { status: 502 });
  }
}
