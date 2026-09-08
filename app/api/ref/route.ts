import { NextRequest, NextResponse } from "next/server";
import { apiError } from "../../../lib/http/apiError";

export async function POST(request: NextRequest) {
  let code: string;
  try {
    const body = await request.json();
    code = (body.code as string)?.trim().toUpperCase();
  } catch {
    // Old shape: NextResponse.json({ error: "..." }, { status }).
    return apiError({
      code: "invalid_request",
      message: "Invalid JSON",
      hint: 'Send a JSON body with Content-Type: application/json, e.g. {"code":"PARTNER123"}.',
    });
  }

  if (!code) {
    return apiError({
      code: "invalid_request",
      message: "Missing code",
      hint: 'Include a non-empty "code" field with the referral code.',
      details: { required: ["code"] },
    });
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
