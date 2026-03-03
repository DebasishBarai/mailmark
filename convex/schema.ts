import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
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
});
