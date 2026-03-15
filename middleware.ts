import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const refCode = request.nextUrl.searchParams.get("ref");

  if (refCode) {
    const response = NextResponse.next();
    response.cookies.set("mailmark_ref", refCode.toUpperCase(), {
      maxAge: 60 * 60 * 24 * 90, // 90 days
      path: "/",
      httpOnly: false, // must be readable by client JS
      sameSite: "lax",
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
