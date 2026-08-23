import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { allowRequest, clientIp } from "../../../../../lib/careersRateLimit";

// A handful of resume uploads per hour is plenty for a genuine applicant
// who re-picks the wrong file a couple of times.
const UPLOAD_LIMIT = 10;
const UPLOAD_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (!allowRequest("careers-upload", ip, UPLOAD_LIMIT, UPLOAD_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Too many upload attempts. Please try again later." },
      { status: 429 }
    );
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json(
      { error: "Applications are temporarily unavailable." },
      { status: 503 }
    );
  }

  try {
    const convex = new ConvexHttpClient(convexUrl);
    const uploadUrl = await convex.mutation(
      api.jobApplications.generateResumeUploadUrl,
      {}
    );
    return NextResponse.json({ uploadUrl });
  } catch (error) {
    console.error("[careers/upload-url] failed:", error);
    return NextResponse.json(
      { error: "Could not start the upload. Please try again." },
      { status: 500 }
    );
  }
}
