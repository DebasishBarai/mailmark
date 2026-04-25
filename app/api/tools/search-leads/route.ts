import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const rateLimit = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): {
  allowed: boolean;
  remaining: number;
} {
  const now = Date.now();
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  const resetAt = midnight.getTime();

  const entry = rateLimit.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimit.set(userId, { count: 1, resetAt });
    return { allowed: true, remaining: 4 };
  }
  if (entry.count >= 5) {
    return { allowed: false, remaining: 0 };
  }
  entry.count++;
  return { allowed: true, remaining: 5 - entry.count };
}

const COMPANY_SIZE_MAP: Record<string, string> = {
  "1-10": "1,10",
  "11-50": "11,50",
  "51-200": "51,200",
  "201-1000": "201,1000",
  "1000+": "1001,10000",
};

interface ApolloOrganization {
  name?: string;
  industry?: string;
  estimated_num_employees?: number;
}

interface ApolloPerson {
  first_name?: string;
  last_name?: string;
  title?: string;
  email?: string;
  country?: string;
  city?: string;
  state?: string;
  organization?: ApolloOrganization;
}

function estimateCompanySize(count?: number): string {
  if (!count) return "Unknown";
  if (count <= 10) return "1-10";
  if (count <= 50) return "11-50";
  if (count <= 200) return "51-200";
  if (count <= 1000) return "201-1000";
  return "1000+";
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Service temporarily unavailable." },
      { status: 503 }
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  const { allowed, remaining } = checkRateLimit(userId);
  if (!allowed) {
    return NextResponse.json(
      {
        error: "Daily search limit reached. Upgrade your plan for more searches.",
        searchesRemaining: 0,
      },
      { status: 429 }
    );
  }

  let body: {
    industry?: string;
    title?: string;
    companySize?: string;
    country?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const apolloParams: Record<string, unknown> = {
    page: 1,
    per_page: 15,
  };

  if (body.title && body.title !== "All Titles") {
    apolloParams.person_titles = [body.title];
  }

  if (body.country && body.country !== "All Countries") {
    apolloParams.person_locations = [body.country];
  }

  if (body.companySize && body.companySize !== "All Sizes") {
    const mapped = COMPANY_SIZE_MAP[body.companySize];
    if (mapped) {
      apolloParams.organization_num_employees_ranges = [mapped];
    }
  }

  if (body.industry && body.industry !== "All Industries") {
    apolloParams.q_organization_keyword_tags = [body.industry];
  }

  try {
    const res = await fetch(
      "https://api.apollo.io/api/v1/mixed_people/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
        },
        body: JSON.stringify(apolloParams),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Apollo API error:", res.status, errorText);
      return NextResponse.json(
        { error: "Failed to search leads. Please try again." },
        { status: 502 }
      );
    }

    const data = await res.json();
    const people: ApolloPerson[] = data.people ?? [];

    const leads = people
      .filter((p: ApolloPerson) => p.email)
      .map((p: ApolloPerson, i: number) => ({
        id: `apollo-${i}`,
        name: [p.first_name, p.last_name].filter(Boolean).join(" "),
        title: p.title ?? "Unknown",
        company: p.organization?.name ?? "Unknown",
        industry: p.organization?.industry ?? "Unknown",
        companySize: estimateCompanySize(
          p.organization?.estimated_num_employees
        ),
        country: p.country ?? "Unknown",
        email: p.email,
      }));

    return NextResponse.json({
      leads,
      searchesRemaining: remaining,
    });
  } catch (err) {
    console.error("Apollo API request failed:", err);
    return NextResponse.json(
      { error: "Failed to search leads. Please try again." },
      { status: 502 }
    );
  }
}
