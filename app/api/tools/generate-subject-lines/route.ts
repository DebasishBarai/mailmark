import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { apiError, methodNotAllowed } from "../../../../lib/http/apiError";

// Errors used to be `NextResponse.json({ error: "..." }, { status })`, which an
// agent cannot branch on. They now go through apiError(), which keeps `error`
// as the same human-readable string and adds `code`, `message`, `hint`,
// `status` and `documentation_url` alongside it. Old shape, for reference:
//
//   return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });

const rateLimit = new Map<
  string,
  { count: number; resetAt: number }
>();

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  const resetAt = midnight.getTime();

  const entry = rateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt });
    return { allowed: true, remaining: 4 };
  }
  if (entry.count >= 5) {
    return { allowed: false, remaining: 0 };
  }
  entry.count++;
  return { allowed: true, remaining: 5 - entry.count };
}

const VALID_TONES = ["casual", "professional", "direct", "friendly", "urgent"];

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return apiError({
      code: "service_unavailable",
      message: "Service temporarily unavailable.",
      hint: "Subject line generation needs an ANTHROPIC_API_KEY on the server. Try again later, or use the tool at https://www.mailmark.dev/tools/subject-line-generator.",
    });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const { allowed, remaining } = checkRateLimit(ip);
  if (!allowed) {
    return apiError({
      code: "rate_limited",
      message:
        "Daily limit reached. Sign up for Mailmark to unlock unlimited generations.",
      hint: "The per-IP daily quota resets 24 hours after your first request. Sign up at https://www.mailmark.dev for unlimited generations.",
      details: { generationsRemaining: 0 },
    });
  }

  let body: { industry?: string; offer?: string; tone?: string };
  try {
    body = await request.json();
  } catch {
    return apiError({
      code: "invalid_request",
      message: "Invalid request body.",
      hint: 'Send a JSON body with Content-Type: application/json, e.g. {"industry":"SaaS","offer":"a demo","tone":"direct"}.',
    });
  }

  const { industry, offer, tone } = body;

  if (!industry || !offer || !tone) {
    return apiError({
      code: "invalid_request",
      message: "Industry, offer, and tone are all required.",
      hint: `Include all three fields. Valid tones: ${VALID_TONES.join(", ")}.`,
      details: { required: ["industry", "offer", "tone"] },
    });
  }

  if (industry.length > 200 || offer.length > 200) {
    return apiError({
      code: "invalid_request",
      message: "Inputs must be under 200 characters each.",
      hint: "Shorten \"industry\" and \"offer\" to 200 characters or fewer.",
      details: { maxLength: 200 },
    });
  }

  if (!VALID_TONES.includes(tone)) {
    return apiError({
      code: "invalid_request",
      message: "Invalid tone selected.",
      hint: `Use one of: ${VALID_TONES.join(", ")}.`,
      details: { allowedTones: VALID_TONES },
    });
  }

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system:
        'You are a cold email subject line expert. You generate subject lines that maximize open rates for cold outreach. Return ONLY a valid JSON array of exactly 8 objects, each with "line" (the subject line, max 60 chars) and "tip" (a one-sentence explanation of why it works). No markdown, no code fences, just the JSON array.',
      messages: [
        {
          role: "user",
          content: `Generate 8 cold email subject lines for someone in the ${industry} industry who is offering: ${offer}. The tone should be ${tone}. Focus on curiosity, personalization hooks, and proven cold email patterns.`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return apiError({
        code: "internal_error",
        message: "Failed to generate subject lines. Please try again.",
        hint: "The model returned no text block. Retry the request.",
      });
    }

    let subjectLines: { line: string; tip: string }[];
    try {
      subjectLines = JSON.parse(textBlock.text);
    } catch {
      return apiError({
        code: "internal_error",
        message: "Failed to parse results. Please try again.",
        hint: "The model returned text that was not the expected JSON array. Retry the request.",
      });
    }

    return NextResponse.json({
      subjectLines,
      generationsRemaining: remaining,
    });
  } catch {
    return apiError({
      code: "internal_error",
      message: "Failed to generate subject lines. Please try again.",
      hint: "The generation service failed. Retry with backoff; if it persists, contact support@mailmark.dev.",
    });
  }
}

// A GET here is a mistake worth explaining, so it answers with a JSON 405 and
// an Allow header instead of the empty body Next.js would return. OPTIONS is
// left to Next, which answers it correctly for CORS preflights.
export const GET = methodNotAllowed(["POST"]);
