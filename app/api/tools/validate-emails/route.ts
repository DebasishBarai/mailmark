import { NextRequest, NextResponse } from "next/server";
import { apiError, methodNotAllowed } from "../../../../lib/http/apiError";
import dns from "node:dns";

const dnsResolver = new dns.promises.Resolver();
dnsResolver.setServers(["8.8.8.8", "1.1.1.1"]);

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "tempmail.com",
  "throwaway.email",
  "yopmail.com",
  "sharklasers.com",
  "guerrillamailblock.com",
  "grr.la",
  "dispostable.com",
  "trashmail.com",
  "trashmail.net",
  "10minutemail.com",
  "tempail.com",
  "fakeinbox.com",
  "mailnesia.com",
  "maildrop.cc",
  "discard.email",
  "mailcatch.com",
  "temp-mail.org",
  "getnada.com",
  "mohmal.com",
  "burnermail.io",
  "inboxbear.com",
  "emailondeck.com",
  "mintemail.com",
  "harakirimail.com",
  "jetable.org",
  "mailexpire.com",
  "spamgourmet.com",
  "mytemp.email",
  "tempinbox.com",
  "throwam.com",
]);

const ROLE_PREFIXES = new Set([
  "info",
  "admin",
  "support",
  "sales",
  "contact",
  "help",
  "billing",
  "noreply",
  "no-reply",
  "postmaster",
  "abuse",
  "webmaster",
  "marketing",
  "team",
  "hello",
  "office",
  "hr",
  "careers",
  "press",
  "media",
  "security",
  "legal",
  "feedback",
  "newsletter",
  "subscribe",
  "unsubscribe",
]);

const FREE_PROVIDERS = new Set([
  "gmail.com",
  "yahoo.com",
  "yahoo.co.in",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "proton.me",
  "zoho.com",
  "mail.com",
  "gmx.com",
  "gmx.net",
  "yandex.com",
  "tutanota.com",
  "fastmail.com",
  "rediffmail.com",
]);

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

const mxCache = new Map<string, { hasMx: boolean; cachedAt: number }>();
const MX_CACHE_TTL = 300_000;

async function checkMxRecord(domain: string): Promise<boolean> {
  const cached = mxCache.get(domain);
  if (cached && Date.now() - cached.cachedAt < MX_CACHE_TTL) {
    return cached.hasMx;
  }

  try {
    const records = await dnsResolver.resolveMx(domain);
    const hasMx = records.length > 0;
    mxCache.set(domain, { hasMx, cachedAt: Date.now() });
    return hasMx;
  } catch {
    mxCache.set(domain, { hasMx: false, cachedAt: Date.now() });
    return false;
  }
}

interface ValidationResult {
  email: string;
  status: "valid" | "risky" | "invalid";
  reason: string;
  checks: {
    syntax: boolean;
    mxRecord: boolean;
    disposable: boolean;
    roleBased: boolean;
    freeProvider: boolean;
  };
}

async function validateEmail(email: string): Promise<ValidationResult> {
  const trimmed = email.trim().toLowerCase();

  const checks = {
    syntax: false,
    mxRecord: false,
    disposable: false,
    roleBased: false,
    freeProvider: false,
  };

  if (!EMAIL_REGEX.test(trimmed)) {
    return { email: trimmed, status: "invalid", reason: "Invalid syntax", checks };
  }
  checks.syntax = true;

  const [localPart, domain] = trimmed.split("@");

  checks.disposable = DISPOSABLE_DOMAINS.has(domain);
  if (checks.disposable) {
    return { email: trimmed, status: "invalid", reason: "Disposable email provider", checks };
  }

  const hasMx = await checkMxRecord(domain);
  checks.mxRecord = hasMx;
  if (!hasMx) {
    return { email: trimmed, status: "invalid", reason: "Domain has no mail server (MX record)", checks };
  }

  checks.roleBased = ROLE_PREFIXES.has(localPart);
  checks.freeProvider = FREE_PROVIDERS.has(domain);

  if (checks.roleBased) {
    return { email: trimmed, status: "risky", reason: "Role-based address (shared inbox)", checks };
  }

  if (checks.freeProvider) {
    return { email: trimmed, status: "risky", reason: "Free email provider", checks };
  }

  return { email: trimmed, status: "valid", reason: "Valid business email", checks };
}

export async function POST(request: NextRequest) {
  let body: { emails?: string[] };
  try {
    body = await request.json();
  } catch {
    // Old shape: NextResponse.json({ error: "..." }, { status: 400 }).
    // apiError keeps `error` and adds the machine-readable fields around it.
    return apiError({
      code: "invalid_request",
      message: "Invalid request body.",
      hint: 'Send a JSON body with Content-Type: application/json, e.g. {"emails":["alice@acme.com"]}.',
    });
  }

  if (!body.emails || !Array.isArray(body.emails) || body.emails.length === 0) {
    return apiError({
      code: "invalid_request",
      message: "Provide at least one email address.",
      hint: '"emails" must be a non-empty array of addresses.',
      details: { required: ["emails"] },
    });
  }

  if (body.emails.length > 100) {
    return apiError({
      code: "invalid_request",
      message: "Maximum 100 emails per validation.",
      hint: "Split the list into batches of 100 addresses or fewer.",
      details: { maxEmails: 100 },
    });
  }

  const uniqueEmails = [...new Set(body.emails.map((e: string) => e.trim().toLowerCase()).filter(Boolean))];

  const results = await Promise.all(uniqueEmails.map(validateEmail));

  const summary = {
    total: results.length,
    valid: results.filter((r) => r.status === "valid").length,
    risky: results.filter((r) => r.status === "risky").length,
    invalid: results.filter((r) => r.status === "invalid").length,
  };

  return NextResponse.json({ results, summary });
}

// A GET here is a mistake worth explaining, so it answers with a JSON 405 and
// an Allow header instead of the empty body Next.js would return. OPTIONS is
// left to Next, which answers it correctly for CORS preflights.
export const GET = methodNotAllowed(["POST"]);
