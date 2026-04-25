import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

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
    return NextResponse.json(
      { error: "Service temporarily unavailable." },
      { status: 503 }
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const { allowed, remaining } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      {
        error:
          "Daily limit reached. Sign up for Mailmark to unlock unlimited generations.",
        generationsRemaining: 0,
      },
      { status: 429 }
    );
  }

  let body: { industry?: string; offer?: string; tone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const { industry, offer, tone } = body;

  if (!industry || !offer || !tone) {
    return NextResponse.json(
      { error: "Industry, offer, and tone are all required." },
      { status: 400 }
    );
  }

  if (industry.length > 200 || offer.length > 200) {
    return NextResponse.json(
      { error: "Inputs must be under 200 characters each." },
      { status: 400 }
    );
  }

  if (!VALID_TONES.includes(tone)) {
    return NextResponse.json(
      { error: "Invalid tone selected." },
      { status: 400 }
    );
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
      return NextResponse.json(
        { error: "Failed to generate subject lines. Please try again." },
        { status: 500 }
      );
    }

    let subjectLines: { line: string; tip: string }[];
    try {
      subjectLines = JSON.parse(textBlock.text);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse results. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      subjectLines,
      generationsRemaining: remaining,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate subject lines. Please try again." },
      { status: 500 }
    );
  }
}
