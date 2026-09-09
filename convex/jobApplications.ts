import { v, ConvexError } from "convex/values";
import {
  mutation,
  query,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { isPlausibleAddress, normalizeAddress } from "./lib/sendPolicy";
import { normalizeUrl, isKnownHeardAbout } from "./lib/jobApplication";

const MAX_NAME = 200;
const MAX_ROLE = 200;
const MAX_LOCATION = 200;
const MAX_NOTE = 5000;

// Same shape of limit as the contact form: this is a public unauthenticated
// mutation, so the caps are the only thing standing between it and a script.
// Lower per sender than the contact form, since nobody applies to the same
// role three times in an hour by accident.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_EMAIL_PER_HOUR = 2;
const MAX_TOTAL_PER_HOUR = 30;

function requireText(value: string, field: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new ConvexError(`${field} is required.`);
  if (trimmed.length > max) {
    throw new ConvexError(`${field} must be ${max} characters or fewer.`);
  }
  return trimmed;
}

/**
 * Store an application from /careers/apply and schedule the notice to the
 * jobs inbox.
 *
 * The role is capped and escaped but not matched against the openings list:
 * that list is page content in app/careers, and importing it here would tie a
 * Convex function to the marketing site. The form does the matching, since it
 * renders the same list, and it drops a role from the URL that is not on it.
 * A hand-rolled POST can therefore name a role we never posted, which costs us
 * a line of text in a notice we send ourselves.
 *
 * Links are normalised and refused unless they are http or https, because the
 * notice renders them as anchors in that email.
 */
export const submit = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: v.string(),
    location: v.string(),
    profileUrl: v.string(),
    resumeUrl: v.optional(v.string()),
    heardAbout: v.string(),
    note: v.string(),
    // Honeypot, as on the contact form.
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.website && args.website.trim().length > 0) {
      return { ok: true as const };
    }

    const name = requireText(args.name, "Name", MAX_NAME);
    const role = requireText(args.role, "Role", MAX_ROLE);
    const location = requireText(args.location, "Location", MAX_LOCATION);
    const note = requireText(args.note, "Note", MAX_NOTE);

    const email = normalizeAddress(args.email);
    if (!isPlausibleAddress(email)) {
      throw new ConvexError("Enter a valid email address.");
    }

    if (!isKnownHeardAbout(args.heardAbout)) {
      throw new ConvexError("Choose how you heard about Mailmark.");
    }

    const profileUrl = normalizeUrl(args.profileUrl);
    if (!profileUrl) {
      throw new ConvexError(
        "Enter a valid link to your portfolio, LinkedIn or GitHub."
      );
    }

    // Optional, so an empty box is fine, but a filled-in one has to be a link.
    let resumeUrl: string | undefined;
    if (args.resumeUrl && args.resumeUrl.trim().length > 0) {
      const normalized = normalizeUrl(args.resumeUrl);
      if (!normalized) {
        throw new ConvexError(
          "That resume link does not look like a URL. Leave it empty if you would rather email it."
        );
      }
      resumeUrl = normalized;
    }

    const since = Date.now() - WINDOW_MS;

    const recentFromSender = await ctx.db
      .query("jobApplications")
      .withIndex("by_email_created_at", (q) =>
        q.eq("email", email).gte("createdAt", since)
      )
      .take(MAX_PER_EMAIL_PER_HOUR);
    if (recentFromSender.length >= MAX_PER_EMAIL_PER_HOUR) {
      throw new ConvexError(
        "We already have your application. Email jobs@mailmark.dev if you need to add anything."
      );
    }

    const recentTotal = await ctx.db
      .query("jobApplications")
      .withIndex("by_created_at", (q) => q.gte("createdAt", since))
      .take(MAX_TOTAL_PER_HOUR);
    if (recentTotal.length >= MAX_TOTAL_PER_HOUR) {
      throw new ConvexError(
        "We are receiving an unusual number of applications right now. Please email jobs@mailmark.dev directly."
      );
    }

    const applicationId = await ctx.db.insert("jobApplications", {
      name,
      email,
      role,
      location,
      profileUrl,
      resumeUrl,
      heardAbout: args.heardAbout,
      note,
      createdAt: Date.now(),
      status: "new",
    });

    await ctx.scheduler.runAfter(
      0,
      internal.jobApplicationActions.notifyJobsInbox,
      { applicationId }
    );

    return { ok: true as const };
  },
});

export const getForNotice = internalQuery({
  args: { applicationId: v.id("jobApplications") },
  handler: async (ctx, { applicationId }) => {
    return await ctx.db.get(applicationId);
  },
});

export const recordNotified = internalMutation({
  args: {
    applicationId: v.id("jobApplications"),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { applicationId, error }) => {
    const application = await ctx.db.get(applicationId);
    if (!application) return;
    await ctx.db.patch(applicationId, {
      status: error ? "failed" : "notified",
      notifiedAt: error ? undefined : Date.now(),
      notifyError: error ? error.slice(0, 500) : undefined,
    });
  },
});

/** Newest applications first, for an admin. */
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
      .query("jobApplications")
      .withIndex("by_created_at")
      .order("desc")
      .take(Math.min(limit ?? 50, 200));
  },
});
