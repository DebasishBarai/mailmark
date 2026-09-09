import { v, ConvexError } from "convex/values";
import {
  mutation,
  query,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { isPlausibleAddress, normalizeAddress } from "./lib/sendPolicy";

// Field caps. Generous enough that a real message never hits them, small
// enough that the form cannot be used to push bulk data into the table.
const MAX_NAME = 200;
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 5000;

// Abuse limits, both measured over the last hour. The per-sender one stops
// a stuck submit button or a bored visitor; the global one bounds what a
// script rotating addresses can cost us, since this mutation is public and
// there is no session to attribute a submission to.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_EMAIL_PER_HOUR = 3;
const MAX_TOTAL_PER_HOUR = 60;

// ConvexError rather than Error: a plain Error reaches the browser as
// "Server Error" on a production deployment, and every refusal below has a
// reason the person filling in the form needs to read.
function requireText(
  value: string,
  field: string,
  max: number
): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new ConvexError(`${field} is required.`);
  if (trimmed.length > max) {
    throw new ConvexError(`${field} must be ${max} characters or fewer.`);
  }
  return trimmed;
}

/**
 * Store a message from the public /contact form and schedule the notice to
 * the support inbox.
 *
 * Public and unauthenticated on purpose: the contact page is a marketing page
 * and most people writing in do not have an account. The row is the record of
 * the message, and the email is a notification on top of it, so the send is
 * scheduled rather than awaited: SES being down loses the notification for a
 * moment, never the message.
 */
export const submit = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    subject: v.string(),
    message: v.string(),
    // Honeypot. A real person never sees this field, so anything in it came
    // from a bot filling every input on the page. Answered with the same
    // success the form shows a human, so the bot has nothing to learn from.
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.website && args.website.trim().length > 0) {
      return { ok: true as const };
    }

    const name = requireText(args.name, "Name", MAX_NAME);
    const subject = requireText(args.subject, "Subject", MAX_SUBJECT);
    const message = requireText(args.message, "Message", MAX_MESSAGE);

    const email = normalizeAddress(args.email);
    if (!isPlausibleAddress(email)) {
      throw new ConvexError("Enter a valid email address.");
    }

    const since = Date.now() - WINDOW_MS;

    const recentFromSender = await ctx.db
      .query("supportRequests")
      .withIndex("by_email_created_at", (q) =>
        q.eq("email", email).gte("createdAt", since)
      )
      .take(MAX_PER_EMAIL_PER_HOUR);
    if (recentFromSender.length >= MAX_PER_EMAIL_PER_HOUR) {
      throw new ConvexError(
        "You have sent several messages already. We have them, and we will reply shortly."
      );
    }

    // .take() and not .collect(): the only question is whether the cap is
    // reached, so reading past it would scan rows for an answer already known.
    const recentTotal = await ctx.db
      .query("supportRequests")
      .withIndex("by_created_at", (q) => q.gte("createdAt", since))
      .take(MAX_TOTAL_PER_HOUR);
    if (recentTotal.length >= MAX_TOTAL_PER_HOUR) {
      throw new ConvexError(
        "We are receiving an unusual number of messages right now. Please email support@mailmark.dev directly."
      );
    }

    const requestId = await ctx.db.insert("supportRequests", {
      name,
      email,
      subject,
      message,
      createdAt: Date.now(),
      status: "new",
    });

    await ctx.scheduler.runAfter(
      0,
      internal.supportActions.notifySupportInbox,
      { requestId }
    );

    return { ok: true as const };
  },
});

export const getForNotice = internalQuery({
  args: { requestId: v.id("supportRequests") },
  handler: async (ctx, { requestId }) => {
    return await ctx.db.get(requestId);
  },
});

export const recordNotified = internalMutation({
  args: {
    requestId: v.id("supportRequests"),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { requestId, error }) => {
    const request = await ctx.db.get(requestId);
    if (!request) return;
    await ctx.db.patch(requestId, {
      status: error ? "failed" : "notified",
      notifiedAt: error ? undefined : Date.now(),
      // Truncated: an AWS error can carry a long request trace, and the row
      // only needs enough of it to say what went wrong.
      notifyError: error ? error.slice(0, 500) : undefined,
    });
  },
});

/**
 * Newest messages first, for an admin. Kept small and paginated by the caller
 * passing a limit, since the table grows without bound.
 */
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user || user.category !== "admin") {
      throw new ConvexError("Admin access required");
    }

    return await ctx.db
      .query("supportRequests")
      .withIndex("by_created_at")
      .order("desc")
      .take(Math.min(limit ?? 50, 200));
  },
});
