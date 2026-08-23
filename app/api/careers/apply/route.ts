import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { allowRequest, clientIp } from "../../../../lib/careersRateLimit";
import { isApplicableSlug, getJobTitle } from "../../../../lib/jobs";

const SUBMIT_LIMIT = 5;
const SUBMIT_WINDOW_MS = 60 * 60 * 1000;

// A genuine applicant does not fill in a cover letter in under three seconds.
const MIN_FILL_MS = 3000;

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (!allowRequest("careers-apply", ip, SUBMIT_LIMIT, SUBMIT_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Too many applications from this address. Please try again later." },
      { status: 429 }
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const {
    jobSlug,
    name,
    email,
    phone,
    location,
    portfolioUrl,
    githubUrl,
    linkedinUrl,
    coverLetter,
    resumeStorageId,
    resumeFilename,
    // Bot traps: `company` is a hidden field no human sees, `startedAt` is
    // when the form was rendered. Both are answered silently so a bot gets
    // no signal about which check caught it.
    company,
    startedAt,
  } = payload ?? {};

  if (typeof company === "string" && company.trim() !== "") {
    return NextResponse.json({ success: true, duplicate: false });
  }
  if (typeof startedAt === "number" && Date.now() - startedAt < MIN_FILL_MS) {
    return NextResponse.json({ success: true, duplicate: false });
  }

  if (typeof jobSlug !== "string" || !isApplicableSlug(jobSlug)) {
    return NextResponse.json({ error: "Unknown role." }, { status: 400 });
  }
  const jobTitle = getJobTitle(jobSlug);
  if (!jobTitle) {
    return NextResponse.json({ error: "Unknown role." }, { status: 400 });
  }

  if (typeof name !== "string" || typeof email !== "string" || typeof coverLetter !== "string") {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (typeof resumeStorageId !== "string" || typeof resumeFilename !== "string") {
    return NextResponse.json({ error: "Please attach your resume." }, { status: 400 });
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json(
      { error: "Applications are temporarily unavailable." },
      { status: 503 }
    );
  }

  const optional = (value: unknown) =>
    typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;

  try {
    const convex = new ConvexHttpClient(convexUrl);
    const result = await convex.mutation(api.jobApplications.submit, {
      jobSlug,
      jobTitle,
      name,
      email,
      phone: optional(phone),
      location: optional(location),
      portfolioUrl: optional(portfolioUrl),
      githubUrl: optional(githubUrl),
      linkedinUrl: optional(linkedinUrl),
      coverLetter,
      resumeStorageId: resumeStorageId as Id<"_storage">,
      resumeFilename,
    });
    return NextResponse.json({ success: true, duplicate: result.duplicate });
  } catch (error) {
    // Convex validation errors carry a message worth showing the applicant
    // (file too large, wrong type, invalid email). Anything else is ours.
    const message = error instanceof Error ? error.message : "";
    const friendly = message.match(/Uncaught Error:\s*(.+?)(?:\n|$)/)?.[1] ?? message;
    console.error("[careers/apply] failed:", error);
    return NextResponse.json(
      { error: friendly || "Something went wrong. Please try again." },
      { status: 400 }
    );
  }
}
