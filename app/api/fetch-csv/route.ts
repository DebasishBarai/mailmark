import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let fetchUrl = url.trim();

  // Convert any Google Sheets URL to a CSV export URL
  const sheetsMatch = fetchUrl.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (sheetsMatch) {
    const id = sheetsMatch[1];
    // Extract optional gid (sheet tab)
    const gidMatch = fetchUrl.match(/[?&#]gid=(\d+)/);
    const gid = gidMatch ? `&gid=${gidMatch[1]}` : "";
    fetchUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid}`;
  }

  try {
    const res = await fetch(fetchUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream responded with ${res.status}` },
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
