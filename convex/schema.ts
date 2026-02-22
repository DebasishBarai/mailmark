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
  })
    .index("by_mailbox_folder", ["mailboxId", "folder"])
    .index("by_message_id", ["messageId"]),
});
