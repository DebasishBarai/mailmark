import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation, action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { countChanged, countCreated, sequenceBuckets } from "./lib/counters";

const stepValidator = v.union(
  v.object({
    type: v.literal("send_email"),
    subject: v.string(),
    html: v.string(),
  }),
  v.object({
    type: v.literal("delay"),
    delayMs: v.number(),
  })
);

// ── Queries ──

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const sequences = await ctx.db
      .query("sequences")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    const enriched = await Promise.all(
      sequences.map(async (seq) => {
        const domain = await ctx.db.get(seq.domainId);
        const mailbox = await ctx.db.get(seq.mailboxId);

        const enrollments = await ctx.db
          .query("sequenceEnrollments")
          .withIndex("by_sequence_id", (q) => q.eq("sequenceId", seq._id))
          .collect();

        const stats = { total: enrollments.length, active: 0, completed: 0, replied: 0, bounced: 0, cancelled: 0 };
        for (const e of enrollments) {
          stats[e.status]++;
        }

        return {
          ...seq,
          domainName: domain?.domain ?? "Unknown",
          mailboxAddress: mailbox?.fullAddress ?? "Unknown",
          stats,
        };
      })
    );

    return enriched;
  },
});

export const getById = query({
  args: { sequenceId: v.id("sequences") },
  handler: async (ctx, { sequenceId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return null;

    const sequence = await ctx.db.get(sequenceId);
    if (!sequence || sequence.userId !== user._id) return null;

    const domain = await ctx.db.get(sequence.domainId);
    const mailbox = await ctx.db.get(sequence.mailboxId);

    const enrollments = await ctx.db
      .query("sequenceEnrollments")
      .withIndex("by_sequence_id", (q) => q.eq("sequenceId", sequenceId))
      .collect();

    const stats = { total: enrollments.length, active: 0, completed: 0, replied: 0, bounced: 0, cancelled: 0 };
    for (const e of enrollments) {
      stats[e.status]++;
    }

    return {
      ...sequence,
      domainName: domain?.domain ?? "Unknown",
      mailboxAddress: mailbox?.fullAddress ?? "Unknown",
      stats,
    };
  },
});

// Old: collect every enrollment on the sequence. A sequence enrolled from a
// CSV holds thousands of them, and the panel that reads this only ever shows
// a screen at a time. Replaced by listEnrollmentsPage below.
//
// export const listEnrollments = query({
//   args: { sequenceId: v.id("sequences") },
//   handler: async (ctx, { sequenceId }) => {
//     const identity = await ctx.auth.getUserIdentity();
//     if (!identity) return [];
////     const user = await ctx.db
//       .query("users")
//       .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
//       .unique();
//     if (!user) return [];
////     const sequence = await ctx.db.get(sequenceId);
//     if (!sequence || sequence.userId !== user._id) return [];
////     return await ctx.db
//       .query("sequenceEnrollments")
//       .withIndex("by_sequence_id", (q) => q.eq("sequenceId", sequenceId))
//       .collect();
//   },
// });
//
/** Enrollments on one sequence, newest first, one page at a time.
 *
 *  A CSV driven sequence carries thousands of these, so the panel reads them a
 *  page at a time rather than all at once. */
export const listEnrollmentsPage = query({
  args: {
    sequenceId: v.id("sequences"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { sequenceId, paginationOpts }) => {
    const empty = { page: [], isDone: true, continueCursor: "" };

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return empty;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return empty;

    const sequence = await ctx.db.get(sequenceId);
    if (!sequence || sequence.userId !== user._id) return empty;

    return await ctx.db
      .query("sequenceEnrollments")
      .withIndex("by_sequence_id", (q) => q.eq("sequenceId", sequenceId))
      .order("desc")
      .paginate(paginationOpts);
  },
});

// ── Mutations ──

export const create = mutation({
  args: {
    domainId: v.id("domains"),
    mailboxId: v.id("mailboxes"),
    name: v.string(),
    steps: v.array(stepValidator),
  },
  handler: async (ctx, { domainId, mailboxId, name, steps }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const domain = await ctx.db.get(domainId);
    if (!domain || domain.userId !== user._id) throw new Error("Not authorized");

    const mailbox = await ctx.db.get(mailboxId);
    if (!mailbox || mailbox.userId !== user._id) throw new Error("Not authorized");

    if (steps.length === 0) throw new Error("Sequence must have at least one step");
    if (steps[0].type !== "send_email") throw new Error("First step must be send_email");

    const id = await ctx.db.insert("sequences", {
      userId: user._id,
      domainId,
      mailboxId,
      name,
      status: "active",
      steps,
      createdAt: Date.now(),
    });
    const created = await ctx.db.get(id);
    if (created) await countCreated(ctx, sequenceBuckets(created));

    return id;
  },
});

export const pause = mutation({
  args: { sequenceId: v.id("sequences") },
  handler: async (ctx, { sequenceId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const sequence = await ctx.db.get(sequenceId);
    if (!sequence || sequence.userId !== user._id) throw new Error("Not authorized");
    if (sequence.status !== "active") throw new Error("Sequence is not active");

    await ctx.db.patch(sequenceId, { status: "paused" });
    const paused = await ctx.db.get(sequenceId);
    if (paused) await countChanged(ctx, sequenceBuckets(sequence), sequenceBuckets(paused));
  },
});

export const resume = mutation({
  args: { sequenceId: v.id("sequences") },
  handler: async (ctx, { sequenceId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const sequence = await ctx.db.get(sequenceId);
    if (!sequence || sequence.userId !== user._id) throw new Error("Not authorized");
    if (sequence.status !== "paused") throw new Error("Sequence is not paused");

    await ctx.db.patch(sequenceId, { status: "active" });
    const resumed = await ctx.db.get(sequenceId);
    if (resumed) await countChanged(ctx, sequenceBuckets(sequence), sequenceBuckets(resumed));
  },
});

export const cancel = mutation({
  args: { sequenceId: v.id("sequences") },
  handler: async (ctx, { sequenceId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const sequence = await ctx.db.get(sequenceId);
    if (!sequence || sequence.userId !== user._id) throw new Error("Not authorized");

    await ctx.db.patch(sequenceId, { status: "completed" });
    const canceled = await ctx.db.get(sequenceId);
    if (canceled) await countChanged(ctx, sequenceBuckets(sequence), sequenceBuckets(canceled));

    const enrollments = await ctx.db
      .query("sequenceEnrollments")
      .withIndex("by_sequence_status", (q) =>
        q.eq("sequenceId", sequenceId).eq("status", "active")
      )
      .collect();

    for (const enrollment of enrollments) {
      await ctx.db.patch(enrollment._id, {
        status: "cancelled",
        completedAt: Date.now(),
      });
    }
  },
});

export const enrollContacts = mutation({
  args: {
    sequenceId: v.id("sequences"),
    contacts: v.array(
      v.object({
        email: v.string(),
        mergeFields: v.optional(v.any()),
      })
    ),
  },
  handler: async (ctx, { sequenceId, contacts }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const sequence = await ctx.db.get(sequenceId);
    if (!sequence || sequence.userId !== user._id) throw new Error("Not authorized");
    if (sequence.status !== "active") throw new Error("Sequence is not active");

    if (contacts.length > 100) throw new Error("Max 100 contacts per request");

    let enrolled = 0;
    let skipped = 0;
    const enrollmentIds: string[] = [];

    for (const contact of contacts) {
      const email = contact.email.toLowerCase().trim();

      const existing = await ctx.db
        .query("sequenceEnrollments")
        .withIndex("by_sequence_email", (q) =>
          q.eq("sequenceId", sequenceId).eq("contactEmail", email)
        )
        .first();

      if (existing && existing.status === "active") {
        skipped++;
        continue;
      }

      const id = await ctx.db.insert("sequenceEnrollments", {
        sequenceId,
        contactEmail: email,
        mergeFields: contact.mergeFields,
        currentStep: 0,
        status: "active",
        enrolledAt: Date.now(),
      });

      enrollmentIds.push(id);
      enrolled++;
    }

    return { enrolled, skipped, enrollmentIds };
  },
});

export const cancelEnrollment = mutation({
  args: { enrollmentId: v.id("sequenceEnrollments") },
  handler: async (ctx, { enrollmentId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const enrollment = await ctx.db.get(enrollmentId);
    if (!enrollment) throw new Error("Enrollment not found");

    const sequence = await ctx.db.get(enrollment.sequenceId);
    if (!sequence || sequence.userId !== user._id) throw new Error("Not authorized");

    if (enrollment.status !== "active") throw new Error("Enrollment is not active");

    await ctx.db.patch(enrollmentId, {
      status: "cancelled",
      completedAt: Date.now(),
    });
  },
});

export const getByMailbox = query({
  args: { mailboxId: v.id("mailboxes") },
  handler: async (ctx, { mailboxId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const mailbox = await ctx.db.get(mailboxId);
    if (!mailbox || mailbox.userId !== user._id) return [];

    const allSequences = await ctx.db
      .query("sequences")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    const sequences = allSequences.filter((s) => s.mailboxId === mailboxId);

    const enriched = await Promise.all(
      sequences.map(async (seq) => {
        const domain = await ctx.db.get(seq.domainId);

        const enrollments = await ctx.db
          .query("sequenceEnrollments")
          .withIndex("by_sequence_id", (q) => q.eq("sequenceId", seq._id))
          .collect();

        const stats = { total: enrollments.length, active: 0, completed: 0, replied: 0, bounced: 0, cancelled: 0 };
        for (const e of enrollments) {
          stats[e.status]++;
        }

        return {
          ...seq,
          domainName: domain?.domain ?? "Unknown",
          mailboxAddress: mailbox.fullAddress ?? "Unknown",
          stats,
        };
      })
    );

    return enriched;
  },
});

export const createAndEnrollWithFirstSent = action({
  args: {
    mailboxId: v.id("mailboxes"),
    domainId: v.id("domains"),
    name: v.string(),
    steps: v.array(stepValidator),
    contacts: v.array(
      v.object({
        email: v.string(),
        mergeFields: v.optional(v.any()),
      })
    ),
  },
  handler: async (ctx, { mailboxId, domainId, name, steps, contacts }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const sequenceId = await ctx.runMutation(internal.sequenceActions.internalCreateSequence, {
      clerkId: identity.subject,
      domainId,
      mailboxId,
      name,
      steps,
    });

    const enrollmentIds: string[] = [];
    for (const contact of contacts) {
      const enrollmentId = await ctx.runMutation(internal.sequenceActions.internalEnrollWithStep, {
        sequenceId,
        contactEmail: contact.email.toLowerCase().trim(),
        mergeFields: contact.mergeFields,
        startStep: 1,
      });
      if (enrollmentId) {
        enrollmentIds.push(enrollmentId);
      }
    }

    for (const enrollmentId of enrollmentIds) {
      const nextStep = steps[1];
      if (!nextStep) continue;

      if (nextStep.type === "delay") {
        await ctx.scheduler.runAfter(
          nextStep.delayMs,
          internal.sequenceProcessing.processStep,
          { enrollmentId: enrollmentId as any, stepIndex: 2 }
        );
      } else {
        await ctx.scheduler.runAfter(
          0,
          internal.sequenceProcessing.processStep,
          { enrollmentId: enrollmentId as any, stepIndex: 1 }
        );
      }
    }

    return { sequenceId, enrolled: enrollmentIds.length };
  },
});

// ── Internal helpers (called by createAndEnrollWithFirstSent action) ──

export const internalCreateSequence = internalMutation({
  args: {
    clerkId: v.string(),
    domainId: v.id("domains"),
    mailboxId: v.id("mailboxes"),
    name: v.string(),
    steps: v.array(stepValidator),
  },
  handler: async (ctx, { clerkId, domainId, mailboxId, name, steps }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    if (!user) throw new Error("User not found");

    const domain = await ctx.db.get(domainId);
    if (!domain || domain.userId !== user._id) throw new Error("Not authorized");

    const mailbox = await ctx.db.get(mailboxId);
    if (!mailbox || mailbox.userId !== user._id) throw new Error("Not authorized");

    if (steps.length === 0) throw new Error("Sequence must have at least one step");
    if (steps[0].type !== "send_email") throw new Error("First step must be send_email");

    const sequenceId = await ctx.db.insert("sequences", {
      userId: user._id,
      domainId,
      mailboxId,
      name,
      status: "active",
      steps,
      createdAt: Date.now(),
    });
    const created = await ctx.db.get(sequenceId);
    if (created) await countCreated(ctx, sequenceBuckets(created));
    return sequenceId;
  },
});

export const internalEnrollWithStep = internalMutation({
  args: {
    sequenceId: v.id("sequences"),
    contactEmail: v.string(),
    mergeFields: v.optional(v.any()),
    startStep: v.number(),
  },
  handler: async (ctx, { sequenceId, contactEmail, mergeFields, startStep }) => {
    const existing = await ctx.db
      .query("sequenceEnrollments")
      .withIndex("by_sequence_email", (q) =>
        q.eq("sequenceId", sequenceId).eq("contactEmail", contactEmail)
      )
      .first();

    if (existing && existing.status === "active") {
      return null;
    }

    return await ctx.db.insert("sequenceEnrollments", {
      sequenceId,
      contactEmail,
      mergeFields,
      currentStep: startStep,
      status: "active",
      enrolledAt: Date.now(),
      lastStepAt: Date.now(),
    });
  },
});
