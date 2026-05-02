import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

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

export const create = internalMutation({
  args: {
    userId: v.id("users"),
    domainId: v.id("domains"),
    mailboxId: v.id("mailboxes"),
    name: v.string(),
    steps: v.array(stepValidator),
  },
  handler: async (ctx, { userId, domainId, mailboxId, name, steps }) => {
    if (steps.length === 0) throw new Error("Sequence must have at least one step");
    if (steps[0].type !== "send_email") throw new Error("First step must be send_email");

    const id = await ctx.db.insert("sequences", {
      userId,
      domainId,
      mailboxId,
      name,
      status: "active",
      steps,
      createdAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

export const getById = internalQuery({
  args: { id: v.id("sequences") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const listByDomain = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    return await ctx.db
      .query("sequences")
      .withIndex("by_domain_id", (q) => q.eq("domainId", domainId))
      .collect();
  },
});

export const pause = internalMutation({
  args: { id: v.id("sequences") },
  handler: async (ctx, { id }) => {
    const seq = await ctx.db.get(id);
    if (!seq) throw new Error("Sequence not found");
    if (seq.status !== "active") throw new Error("Sequence is not active");
    await ctx.db.patch(id, { status: "paused" });
    return await ctx.db.get(id);
  },
});

export const resume = internalMutation({
  args: { id: v.id("sequences") },
  handler: async (ctx, { id }) => {
    const seq = await ctx.db.get(id);
    if (!seq) throw new Error("Sequence not found");
    if (seq.status !== "paused") throw new Error("Sequence is not paused");
    await ctx.db.patch(id, { status: "active" });
    return await ctx.db.get(id);
  },
});

export const cancel = internalMutation({
  args: { id: v.id("sequences") },
  handler: async (ctx, { id }) => {
    const seq = await ctx.db.get(id);
    if (!seq) throw new Error("Sequence not found");
    await ctx.db.patch(id, { status: "completed" });

    const enrollments = await ctx.db
      .query("sequenceEnrollments")
      .withIndex("by_sequence_status", (q) =>
        q.eq("sequenceId", id).eq("status", "active")
      )
      .collect();

    for (const enrollment of enrollments) {
      await ctx.db.patch(enrollment._id, {
        status: "cancelled",
        completedAt: Date.now(),
      });
    }

    return await ctx.db.get(id);
  },
});

export const enroll = internalMutation({
  args: {
    sequenceId: v.id("sequences"),
    contactEmail: v.string(),
    mergeFields: v.optional(v.any()),
  },
  handler: async (ctx, { sequenceId, contactEmail, mergeFields }) => {
    const existing = await ctx.db
      .query("sequenceEnrollments")
      .withIndex("by_sequence_email", (q) =>
        q.eq("sequenceId", sequenceId).eq("contactEmail", contactEmail)
      )
      .first();

    if (existing && existing.status === "active") {
      throw new Error(`${contactEmail} is already enrolled in this sequence`);
    }

    const id = await ctx.db.insert("sequenceEnrollments", {
      sequenceId,
      contactEmail: contactEmail.toLowerCase(),
      mergeFields,
      currentStep: 0,
      status: "active",
      enrolledAt: Date.now(),
    });
    return id;
  },
});

export const getEnrollment = internalQuery({
  args: { id: v.id("sequenceEnrollments") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const listEnrollments = internalQuery({
  args: { sequenceId: v.id("sequences") },
  handler: async (ctx, { sequenceId }) => {
    return await ctx.db
      .query("sequenceEnrollments")
      .withIndex("by_sequence_id", (q) => q.eq("sequenceId", sequenceId))
      .collect();
  },
});

export const advanceEnrollment = internalMutation({
  args: {
    enrollmentId: v.id("sequenceEnrollments"),
    nextStep: v.number(),
    scheduledJobId: v.optional(v.string()),
  },
  handler: async (ctx, { enrollmentId, nextStep, scheduledJobId }) => {
    await ctx.db.patch(enrollmentId, {
      currentStep: nextStep,
      lastStepAt: Date.now(),
      scheduledJobId,
    });
  },
});

export const completeEnrollment = internalMutation({
  args: {
    enrollmentId: v.id("sequenceEnrollments"),
    status: v.union(
      v.literal("completed"),
      v.literal("replied"),
      v.literal("bounced"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, { enrollmentId, status }) => {
    await ctx.db.patch(enrollmentId, {
      status,
      completedAt: Date.now(),
    });
  },
});

export const getEnrollmentStats = internalQuery({
  args: { sequenceId: v.id("sequences") },
  handler: async (ctx, { sequenceId }) => {
    const enrollments = await ctx.db
      .query("sequenceEnrollments")
      .withIndex("by_sequence_id", (q) => q.eq("sequenceId", sequenceId))
      .collect();

    const stats = {
      total: enrollments.length,
      active: 0,
      completed: 0,
      replied: 0,
      bounced: 0,
      cancelled: 0,
    };

    for (const e of enrollments) {
      stats[e.status]++;
    }

    return stats;
  },
});
