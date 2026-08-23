import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Resume upload constraints. Kept in sync with the client-side check in
// app/careers/[slug]/apply/ApplyForm.tsx, but enforced here because the
// client-side check is only a courtesy.
export const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_RESUME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// Same applicant applying to the same role twice inside this window is
// treated as a duplicate submission rather than a new application.
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

const MAX_COVER_LETTER_CHARS = 8000;

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

// Accept only http(s) links so a submitted "url" can never become a
// javascript: or data: URI once it is rendered as an anchor in the
// notification email.
function sanitiseUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

/**
 * Hands the browser a one-shot Convex upload URL for the resume.
 *
 * This is public because the applicant is anonymous, but the careers form
 * reaches it through /api/careers/apply/upload-url so the common path is
 * rate limited by IP. Files uploaded without a matching application row are
 * swept by the `cleanup orphaned resumes` cron.
 */
export const generateResumeUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Stores an application and schedules the email pipeline.
 *
 * The row is written first and the emails are sent afterwards, so a transient
 * SES or S3 failure never loses an application: the record survives and
 * `deliveryError` records what went wrong.
 */
export const submit = mutation({
  args: {
    jobSlug: v.string(),
    jobTitle: v.string(),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    location: v.optional(v.string()),
    portfolioUrl: v.optional(v.string()),
    githubUrl: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    coverLetter: v.string(),
    resumeStorageId: v.id("_storage"),
    resumeFilename: v.string(),
  },
  handler: async (ctx, args) => {
    const email = normaliseEmail(args.email);
    const name = args.name.trim();
    const coverLetter = args.coverLetter.trim();

    if (!name) throw new Error("Please enter your name.");
    if (!isValidEmail(email)) throw new Error("Please enter a valid email address.");
    if (!coverLetter) throw new Error("Please tell us why you're a good fit.");
    if (coverLetter.length > MAX_COVER_LETTER_CHARS) {
      throw new Error(
        `Your cover letter is too long (max ${MAX_COVER_LETTER_CHARS.toLocaleString()} characters).`
      );
    }

    // Verify the uploaded file server-side. The browser check can be skipped,
    // this one cannot: `_storage` metadata is written by Convex itself.
    const resume = await ctx.db.system.get(args.resumeStorageId);
    if (!resume) {
      throw new Error("We couldn't find your uploaded resume. Please attach it again.");
    }
    if (resume.size > MAX_RESUME_BYTES) {
      await ctx.storage.delete(args.resumeStorageId);
      throw new Error("Your resume is larger than 5MB. Please upload a smaller file.");
    }
    const contentType = resume.contentType ?? "";
    if (!ALLOWED_RESUME_TYPES.includes(contentType)) {
      await ctx.storage.delete(args.resumeStorageId);
      throw new Error("Your resume must be a PDF, DOC or DOCX file.");
    }

    // Duplicate suppression: drop the newly uploaded file and report success
    // so a double-submit does not produce two inbox copies.
    const previous = await ctx.db
      .query("jobApplications")
      .withIndex("by_email_job", (q) =>
        q.eq("email", email).eq("jobSlug", args.jobSlug)
      )
      .order("desc")
      .first();
    const duplicate =
      previous && previous.submittedAt >= Date.now() - DUPLICATE_WINDOW_MS
        ? previous
        : null;
    if (duplicate) {
      await ctx.storage.delete(args.resumeStorageId);
      return { applicationId: duplicate._id, duplicate: true };
    }

    const applicationId = await ctx.db.insert("jobApplications", {
      jobSlug: args.jobSlug,
      jobTitle: args.jobTitle,
      name,
      email,
      phone: args.phone?.trim() || undefined,
      location: args.location?.trim() || undefined,
      portfolioUrl: sanitiseUrl(args.portfolioUrl),
      githubUrl: sanitiseUrl(args.githubUrl),
      linkedinUrl: sanitiseUrl(args.linkedinUrl),
      coverLetter,
      resumeStorageId: args.resumeStorageId,
      resumeFilename: args.resumeFilename.trim() || "resume",
      resumeContentType: contentType,
      resumeSize: resume.size,
      status: "new",
      source: "portal",
      submittedAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.jobsPipeline.deliverApplication, {
      applicationId,
    });

    return { applicationId, duplicate: false };
  },
});

export const getInternal = internalQuery({
  args: { applicationId: v.id("jobApplications") },
  handler: async (ctx, { applicationId }) => {
    return await ctx.db.get(applicationId);
  },
});

export const recordInboxDelivery = internalMutation({
  args: {
    applicationId: v.id("jobApplications"),
    inboxEmailId: v.id("emails"),
  },
  handler: async (ctx, { applicationId, inboxEmailId }) => {
    await ctx.db.patch(applicationId, {
      inboxEmailId,
      inboxDeliveredAt: Date.now(),
    });
  },
});

export const recordAckSent = internalMutation({
  args: {
    applicationId: v.id("jobApplications"),
    ackMessageId: v.string(),
  },
  handler: async (ctx, { applicationId, ackMessageId }) => {
    await ctx.db.patch(applicationId, {
      ackMessageId,
      ackSentAt: Date.now(),
    });
  },
});

export const recordDeliveryError = internalMutation({
  args: {
    applicationId: v.id("jobApplications"),
    error: v.string(),
  },
  handler: async (ctx, { applicationId, error }) => {
    await ctx.db.patch(applicationId, { deliveryError: error.slice(0, 1000) });
  },
});

/**
 * Deletes resume files that were uploaded but never attached to an
 * application (abandoned forms, or direct calls to generateResumeUploadUrl).
 * Runs daily from convex/crons.ts.
 */
export const cleanupOrphanedResumes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;

    // Newest first, bounded. Abandoned uploads are by nature recent, so the
    // newest slice is where orphans actually live. Scanning oldest-first
    // would stall permanently once the oldest 500 files are all referenced
    // by real applications.
    const files = await ctx.db.system.query("_storage").order("desc").take(500);

    let deleted = 0;
    for (const file of files) {
      // Skip anything still inside the grace window: a form may be mid-submit.
      if (file._creationTime >= cutoff) continue;

      // An application row is inserted seconds after its upload, so only a
      // narrow slice of rows can possibly reference this file. Querying that
      // window keeps the check bounded instead of collecting every row.
      const candidates = await ctx.db
        .query("jobApplications")
        .withIndex("by_creation_time", (q) =>
          q
            .gte("_creationTime", file._creationTime - 5 * 60 * 1000)
            .lte("_creationTime", file._creationTime + 60 * 60 * 1000)
        )
        .collect();

      const referenced = candidates.some((a) => a.resumeStorageId === file._id);
      if (referenced) continue;

      await ctx.storage.delete(file._id as Id<"_storage">);
      deleted++;
    }
    return { deleted };
  },
});

// ── Admin-facing reads (the /admin applications view is not built yet, but
// the data is stored, so these keep it one step away) ───────────────────────

export const listForAdmin = query({
  args: { jobSlug: v.optional(v.string()) },
  handler: async (ctx, { jobSlug }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user || user.category !== "admin") return [];

    const applications = jobSlug
      ? await ctx.db
          .query("jobApplications")
          .withIndex("by_job_slug", (q) => q.eq("jobSlug", jobSlug))
          .order("desc")
          .take(200)
      : await ctx.db.query("jobApplications").order("desc").take(200);

    return applications;
  },
});
