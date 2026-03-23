"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import dns from "node:dns";

const dnsResolver = new dns.promises.Resolver();
dnsResolver.setServers(["8.8.8.8", "1.1.1.1"]);

// Cache duration: 7 days (MX records rarely change)
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Known disposable email domains
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "tempmail.com", "throwaway.email",
  "yopmail.com", "sharklasers.com", "guerrillamailblock.com", "grr.la",
  "dispostable.com", "trashmail.com", "10minutemail.com", "tempail.com",
  "fakeinbox.com", "mailnesia.com", "maildrop.cc", "discard.email",
]);

// ── Syntax validation ──

function isValidEmailSyntax(email: string): boolean {
  // RFC 5321 simplified: local@domain, domain has at least one dot
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return re.test(email);
}

// ── Actions (node runtime for DNS lookups) ──

export const verifyEmail = action({
  args: { email: v.string() },
  handler: async (ctx, { email }): Promise<{
    email: string;
    isValid: boolean;
    syntaxValid: boolean;
    mxValid: boolean;
    isDisposable: boolean;
    reason?: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return await verifyEmailInternal(ctx, email);
  },
});

export const verifyEmails = action({
  args: { emails: v.array(v.string()) },
  handler: async (ctx, { emails }): Promise<{
    results: Array<{
      email: string;
      isValid: boolean;
      syntaxValid: boolean;
      mxValid: boolean;
      isDisposable: boolean;
      reason?: string;
    }>;
    summary: { total: number; valid: number; invalid: number };
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const results = await Promise.all(
      emails.map((email) => verifyEmailInternal(ctx, email))
    );

    const valid = results.filter((r) => r.isValid).length;
    return {
      results,
      summary: { total: results.length, valid, invalid: results.length - valid },
    };
  },
});

// Internal verify action used by sending paths (no Clerk auth needed)
export const verifyRecipientsBeforeSend = internalAction({
  args: { emails: v.array(v.string()) },
  handler: async (ctx, { emails }): Promise<{
    allValid: boolean;
    invalid: string[];
  }> => {
    const results = await Promise.all(
      emails.map((email) => verifyEmailInternal(ctx, email))
    );

    const invalid = results.filter((r) => !r.isValid).map((r) => r.email);
    return { allValid: invalid.length === 0, invalid };
  },
});

// Shared verification logic
async function verifyEmailInternal(
  ctx: { runQuery: Function; runMutation: Function },
  email: string
): Promise<{
  email: string;
  isValid: boolean;
  syntaxValid: boolean;
  mxValid: boolean;
  isDisposable: boolean;
  reason?: string;
}> {
  const normalized = email.toLowerCase().trim();

  // Check cache first
  const cached = await ctx.runQuery(
    internal.emailVerificationQueries.getCachedVerification,
    { email: normalized }
  );
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
    const domain = normalized.split("@")[1] ?? "";
    return {
      email: normalized,
      isValid: cached.isValid,
      syntaxValid: cached.syntaxValid,
      mxValid: cached.mxValid,
      isDisposable: DISPOSABLE_DOMAINS.has(domain),
      reason: cached.reason,
    };
  }

  // Step 1: Syntax check
  const syntaxValid = isValidEmailSyntax(normalized);
  if (!syntaxValid) {
    const result = {
      email: normalized,
      isValid: false,
      syntaxValid: false,
      mxValid: false,
      isDisposable: false,
      reason: "Invalid email syntax",
    };
    await ctx.runMutation(internal.emailVerificationQueries.upsertVerification, {
      email: normalized,
      isValid: false,
      syntaxValid: false,
      mxValid: false,
      reason: result.reason,
      checkedAt: Date.now(),
    });
    return result;
  }

  const domain = normalized.split("@")[1];
  const isDisposable = DISPOSABLE_DOMAINS.has(domain);

  // Step 2: MX record lookup
  let mxValid = false;
  let reason: string | undefined;
  try {
    const mxRecords = await dnsResolver.resolveMx(domain);
    mxValid = mxRecords.length > 0;
    if (!mxValid) {
      // Fallback: check A record (some domains accept mail without MX)
      try {
        const aRecords = await dnsResolver.resolve4(domain);
        mxValid = aRecords.length > 0;
        if (!mxValid) reason = "Domain has no MX or A records";
      } catch {
        reason = "Domain has no MX or A records";
      }
    }
  } catch {
    // NXDOMAIN or other DNS failure
    reason = "Domain does not exist";
    mxValid = false;
  }

  if (isDisposable) {
    reason = "Disposable email address";
  }

  const isValid = syntaxValid && mxValid && !isDisposable;

  await ctx.runMutation(internal.emailVerificationQueries.upsertVerification, {
    email: normalized,
    isValid,
    syntaxValid,
    mxValid,
    reason,
    checkedAt: Date.now(),
  });

  return { email: normalized, isValid, syntaxValid, mxValid, isDisposable, reason };
}
