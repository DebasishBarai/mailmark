import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    polarCustomerId: v.optional(v.string()),
    // User category: "beta" users bypass the paywall
    category: v.optional(v.union(v.literal("beta"), v.literal("normal"), v.literal("admin"))),
    // Appearance preferences
    prefTheme: v.optional(v.string()),
    prefDensity: v.optional(v.string()),
    prefWallpaper: v.optional(v.string()),
  }).index("by_clerk_id", ["clerkId"]),

  domains: defineTable({
    userId: v.id("users"),
    domain: v.string(),
    verified: v.boolean(),
    mxVerified: v.boolean(),
    spfVerified: v.boolean(),
    dkimVerified: v.boolean(),
    dmarcVerified: v.boolean(),
    // SES verification data
    sesVerificationToken: v.optional(v.string()),
    sesDkimTokens: v.optional(v.array(v.string())),
    sesReceiptRuleCreated: v.optional(v.boolean()),
    // Per-DKIM-token verification status (matches sesDkimTokens order)
    dkimRecordStatus: v.optional(v.array(v.boolean())),
    // Actual DNS values found during verification
    actualMxValue: v.optional(v.string()),
    actualSpfValue: v.optional(v.string()),
    actualDmarcValue: v.optional(v.string()),
    // Custom MAIL FROM domain verification (mail.yourdomain.com)
    mailFromMxVerified: v.optional(v.boolean()),
    mailFromSpfVerified: v.optional(v.boolean()),
  })
    .index("by_user_id", ["userId"])
    .index("by_domain", ["domain"]),

  mailboxes: defineTable({
    domainId: v.id("domains"),
    userId: v.id("users"),
    address: v.string(),
    fullAddress: v.string(),
    displayName: v.optional(v.string()),
    signature: v.optional(v.string()),
  })
    .index("by_domain_id", ["domainId"])
    .index("by_user_id", ["userId"])
    .index("by_full_address", ["fullAddress"]),

  emails: defineTable({
    mailboxId: v.id("mailboxes"),
    messageId: v.string(),
    sesMessageId: v.optional(v.string()),
    folder: v.string(),
    from: v.string(),
    to: v.array(v.string()),
    cc: v.optional(v.array(v.string())),
    bcc: v.optional(v.array(v.string())),
    subject: v.string(),
    snippet: v.string(),
    date: v.number(),
    read: v.boolean(),
    starred: v.boolean(),
    hasAttachments: v.boolean(),
    s3Key: v.string(),
    // Delivery tracking: set when SES delivery notification is received
    deliveryStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("delivered"),
      v.literal("failed"),
      v.literal("bounced")
    )),
    deliveredAt: v.optional(v.number()),
    // Open tracking: set when recipient loads the tracking pixel
    openedAt: v.optional(v.number()),
    // Batch ID: shared across all per-recipient emails sent in one compose action
    batchId: v.optional(v.string()),
    // Scheduled send: set when the user schedules the email for later delivery
    scheduledAt: v.optional(v.number()),
    scheduledJobId: v.optional(v.string()),
  })
    .index("by_mailbox_folder", ["mailboxId", "folder"])
    .index("by_message_id", ["messageId"])
    .index("by_ses_message_id", ["sesMessageId"]),

  contacts: defineTable({
    userId: v.id("users"),
    email: v.string(),
    name: v.string(),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_email", ["userId", "email"]),

  senderGroups: defineTable({
    domainId: v.id("domains"),
    mailboxIds: v.array(v.id("mailboxes")),
    name: v.string(),
    emails: v.array(v.string()),
  }).index("by_domain_id", ["domainId"]),

  subscriptions: defineTable({
    userId: v.id("users"),
    plan: v.union(v.literal("starter"), v.literal("pro"), v.literal("business")),
    status: v.union(
      v.literal("active"),
      v.literal("trialing"),
      v.literal("canceled"),
      v.literal("past_due")
    ),
    priceMonthly: v.number(), // cents
    startedAt: v.number(),
    canceledAt: v.optional(v.number()),
    polarSubscriptionId: v.optional(v.string()),
  })
    .index("by_user_id", ["userId"]),

  affiliates: defineTable({
    userId: v.id("users"),
    code: v.string(),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    payoutEmail: v.string(),
    website: v.optional(v.string()),
    audienceDescription: v.string(),
    totalEarnedCents: v.number(),
    totalPaidCents: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_code", ["code"]),

  referrals: defineTable({
    affiliateId: v.id("affiliates"),
    referredUserId: v.id("users"),
    plan: v.optional(v.union(v.literal("starter"), v.literal("pro"), v.literal("business"))),
    commissionCents: v.number(),
    status: v.union(v.literal("pending"), v.literal("active"), v.literal("paid"), v.literal("canceled")),
    polarSubscriptionId: v.optional(v.string()),
  })
    .index("by_affiliateId", ["affiliateId"])
    .index("by_referredUserId", ["referredUserId"])
    .index("by_polarSubscriptionId", ["polarSubscriptionId"]),

  affiliatePayouts: defineTable({
    affiliateId: v.id("affiliates"),
    amountCents: v.number(),
    status: v.union(v.literal("pending"), v.literal("processed")),
    processedAt: v.optional(v.number()),
    note: v.optional(v.string()),
  }).index("by_affiliateId", ["affiliateId"]),

  warmingSchedules: defineTable({
    userId: v.id("users"),
    domainId: v.id("domains"),
    mailboxId: v.id("mailboxes"),
    status: v.union(v.literal("active"), v.literal("paused"), v.literal("completed")),
    currentDay: v.number(),
    totalDays: v.number(),
    dailyLimit: v.number(),
    sentToday: v.number(),
    lastSentAt: v.optional(v.number()),
    startedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_domain_id", ["domainId"])
    .index("by_mailbox_id", ["mailboxId"])
    .index("by_status", ["status"]),

  domainHealthChecks: defineTable({
    userId: v.id("users"),
    domainId: v.id("domains"),
    checkedAt: v.number(),
    overallScore: v.number(),
    spfValid: v.boolean(),
    dkimValid: v.boolean(),
    dmarcValid: v.boolean(),
    blacklisted: v.boolean(),
    blacklistEntries: v.optional(v.array(v.string())),
    bounceRate: v.number(),
    complaintRate: v.number(),
    reputationStatus: v.union(v.literal("healthy"), v.literal("warning"), v.literal("critical")),
  })
    .index("by_domain_id", ["domainId"])
    .index("by_user_id", ["userId"]),

  unsubscribes: defineTable({
    domainId: v.id("domains"),
    email: v.string(),
    token: v.string(),
    unsubscribedAt: v.number(),
    source: v.union(v.literal("one-click"), v.literal("link"), v.literal("manual")),
    mailboxAddress: v.optional(v.string()),
  })
    .index("by_domain_email", ["domainId", "email"])
    .index("by_token", ["token"])
    .index("by_domain_id", ["domainId"]),

  emailVerifications: defineTable({
    email: v.string(),
    isValid: v.boolean(),
    syntaxValid: v.boolean(),
    mxValid: v.boolean(),
    reason: v.optional(v.string()),
    checkedAt: v.number(),
  })
    .index("by_email", ["email"]),

  // inboxPlacementTests: defineTable({
  //   userId: v.id("users"),
  //   domainId: v.id("domains"),
  //   mailboxId: v.id("mailboxes"),
  //   status: v.union(
  //     v.literal("pending"),
  //     v.literal("sending"),
  //     v.literal("waiting"),
  //     v.literal("completed"),
  //     v.literal("failed")
  //   ),
  //   subject: v.string(),
  //   htmlBody: v.string(),
  //   createdAt: v.number(),
  //   completedAt: v.optional(v.number()),
  // })
  //   .index("by_user_id", ["userId"])
  //   .index("by_domain_id", ["domainId"]),

  // inboxPlacementResults: defineTable({
  //   testId: v.id("inboxPlacementTests"),
  //   provider: v.string(),
  //   seedEmail: v.string(),
  //   placement: v.optional(v.union(
  //     v.literal("inbox"),
  //     v.literal("promotions"),
  //     v.literal("spam"),
  //     v.literal("not_received")
  //   )),
  //   receivedAt: v.optional(v.number()),
  //   reportedAt: v.optional(v.number()),
  //   messageId: v.optional(v.string()),
  // })
  //   .index("by_test_id", ["testId"])
  //   .index("by_message_id", ["messageId"]),

  api_keys: defineTable({
    userId: v.id("users"),
    domainId: v.id("domains"),
    name: v.string(),
    keyHash: v.string(),
    keyPrefix: v.string(),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_user_id", ["userId"])
    .index("by_key_hash", ["keyHash"]),
});
