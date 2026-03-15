import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let code: string;
  try {
    const body = await request.json();
    code = (body.code as string)?.trim().toUpperCase();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("mailmark_ref", code, {
    maxAge: 60 * 60 * 24 * 90, // 90 days
    path: "/",
    httpOnly: false, // must be readable by client JS for attribution
    sameSite: "lax",
  });
  return response;
}
