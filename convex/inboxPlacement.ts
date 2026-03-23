import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";

// Seed email addresses for inbox placement testing.
// These are mailboxes you own/control across providers to check placement.
// In production these would be configurable per-account; here we use built-in seeds.
const SEED_ACCOUNTS = [
  { provider: "Gmail", email: "seed-test@gmail.com", label: "Gmail (Primary)" },
  { provider: "Gmail", email: "seed-promo@gmail.com", label: "Gmail (Promotions check)" },
  { provider: "Outlook", email: "seed-test@outlook.com", label: "Outlook / Hotmail" },
  { provider: "Yahoo", email: "seed-test@yahoo.com", label: "Yahoo Mail" },
  { provider: "iCloud", email: "seed-test@icloud.com", label: "Apple iCloud" },
];

export const getSeedAccounts = query({
  args: {},
  handler: async () => {
    return SEED_ACCOUNTS.map((s) => ({
      provider: s.provider,
      email: s.email,
      label: s.label,
    }));
  },
});

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

    const tests = await ctx.db
      .query("inboxPlacementTests")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50);

    // Attach results to each test
    const withResults = await Promise.all(
      tests.map(async (test) => {
        const results = await ctx.db
          .query("inboxPlacementResults")
          .withIndex("by_test_id", (q) => q.eq("testId", test._id))
          .collect();
        return { ...test, results };
      })
    );

    return withResults;
  },
});

export const getTest = query({
  args: { testId: v.id("inboxPlacementTests") },
  handler: async (ctx, { testId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return null;

    const test = await ctx.db.get(testId);
    if (!test || test.userId !== user._id) return null;

    const results = await ctx.db
      .query("inboxPlacementResults")
      .withIndex("by_test_id", (q) => q.eq("testId", testId))
      .collect();

    return { ...test, results };
  },
});

// ── Mutations ──

export const createTest = mutation({
  args: {
    mailboxId: v.id("mailboxes"),
    subject: v.string(),
    htmlBody: v.string(),
    seedEmails: v.array(v.string()),
  },
  handler: async (ctx, { mailboxId, subject, htmlBody, seedEmails }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const mailbox = await ctx.db.get(mailboxId);
    if (!mailbox || mailbox.userId !== user._id) throw new Error("Mailbox not found");

    const testId = await ctx.db.insert("inboxPlacementTests", {
      userId: user._id,
      domainId: mailbox.domainId,
      mailboxId,
      status: "pending",
      subject,
      htmlBody,
      createdAt: Date.now(),
    });

    // Create a result row for each seed email
    for (const seedEmail of seedEmails) {
      const provider = SEED_ACCOUNTS.find((s) => s.email === seedEmail)?.provider ?? "Other";
      await ctx.db.insert("inboxPlacementResults", {
        testId,
        provider,
        seedEmail,
      });
    }

    return testId;
  },
});

export const markTestSending = mutation({
  args: { testId: v.id("inboxPlacementTests") },
  handler: async (ctx, { testId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const test = await ctx.db.get(testId);
    if (!test) throw new Error("Test not found");

    await ctx.db.patch(testId, { status: "sending" });
  },
});

export const markTestWaiting = mutation({
  args: { testId: v.id("inboxPlacementTests") },
  handler: async (ctx, { testId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const test = await ctx.db.get(testId);
    if (!test) throw new Error("Test not found");

    await ctx.db.patch(testId, { status: "waiting" });
  },
});

export const markTestCompleted = mutation({
  args: { testId: v.id("inboxPlacementTests") },
  handler: async (ctx, { testId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const test = await ctx.db.get(testId);
    if (!test) throw new Error("Test not found");

    await ctx.db.patch(testId, { status: "completed", completedAt: Date.now() });
  },
});

export const markTestFailed = mutation({
  args: { testId: v.id("inboxPlacementTests") },
  handler: async (ctx, { testId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    await ctx.db.patch(testId, { status: "failed", completedAt: Date.now() });
  },
});

export const reportPlacement = mutation({
  args: {
    testId: v.id("inboxPlacementTests"),
    seedEmail: v.string(),
    placement: v.union(
      v.literal("inbox"),
      v.literal("promotions"),
      v.literal("spam"),
      v.literal("not_received")
    ),
  },
  handler: async (ctx, { testId, seedEmail, placement }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const test = await ctx.db.get(testId);
    if (!test) throw new Error("Test not found");

    // Find the result row for this seed email
    const result = await ctx.db
      .query("inboxPlacementResults")
      .withIndex("by_test_id", (q) => q.eq("testId", testId))
      .collect()
      .then((results) => results.find((r) => r.seedEmail === seedEmail));

    if (!result) throw new Error("Seed email not found in test");

    await ctx.db.patch(result._id, {
      placement,
      reportedAt: Date.now(),
      receivedAt: placement !== "not_received" ? Date.now() : undefined,
    });

    // Check if all results are reported — auto-complete the test
    const allResults = await ctx.db
      .query("inboxPlacementResults")
      .withIndex("by_test_id", (q) => q.eq("testId", testId))
      .collect();
    const allReported = allResults.every((r) => r.reportedAt !== undefined);
    if (allReported) {
      await ctx.db.patch(testId, { status: "completed", completedAt: Date.now() });
    }
  },
});

// ── Internal mutations (for HTTP callbacks) ──

export const reportPlacementByMessageId = internalMutation({
  args: {
    messageId: v.string(),
    placement: v.union(
      v.literal("inbox"),
      v.literal("promotions"),
      v.literal("spam"),
      v.literal("not_received")
    ),
    seedEmail: v.string(),
  },
  handler: async (ctx, { messageId, placement, seedEmail }) => {
    const result = await ctx.db
      .query("inboxPlacementResults")
      .withIndex("by_message_id", (q) => q.eq("messageId", messageId))
      .first();

    if (!result) return;

    await ctx.db.patch(result._id, {
      placement,
      reportedAt: Date.now(),
      receivedAt: placement !== "not_received" ? Date.now() : undefined,
    });

    // Auto-complete test if all results are in
    const allResults = await ctx.db
      .query("inboxPlacementResults")
      .withIndex("by_test_id", (q) => q.eq("testId", result.testId))
      .collect();
    const allReported = allResults.every((r) => r.reportedAt !== undefined);
    if (allReported) {
      await ctx.db.patch(result.testId, { status: "completed", completedAt: Date.now() });
    }
  },
});

export const updateResultMessageId = internalMutation({
  args: {
    testId: v.id("inboxPlacementTests"),
    seedEmail: v.string(),
    messageId: v.string(),
  },
  handler: async (ctx, { testId, seedEmail, messageId }) => {
    const results = await ctx.db
      .query("inboxPlacementResults")
      .withIndex("by_test_id", (q) => q.eq("testId", testId))
      .collect();
    const result = results.find((r) => r.seedEmail === seedEmail);
    if (result) {
      await ctx.db.patch(result._id, { messageId });
    }
  },
});
