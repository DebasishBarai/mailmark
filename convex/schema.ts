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
    // When the Google Ads trial-signup conversion was reported for this user.
    // Absent means it is still owed. The old design carried that fact only in
    // addUser's in-memory isNew reply, so a fire lost on the signup page load
    // (tag blocked, tab closed, user clicked through to Polar checkout) could
    // never be retried: every later addUser found the row and answered false.
    // Persisting it lets the client settle the debt on any later visit.
    signupConversionReportedAt: v.optional(v.number()),
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
    // Raw SES identity statuses from the most recent verification check,
    // stored verbatim as GetEmailIdentity returned them. The booleans above
    // collapse "Pending" and "Failed" into a single false, which hides the
    // difference that matters when debugging a stuck domain: Pending means
    // SES is still polling DNS, Failed means it gave up after 72 hours and
    // will never retry without the identity being recreated.
    sesDkimStatus: v.optional(v.string()),
    sesMailFromStatus: v.optional(v.string()),
    sesVerifiedForSending: v.optional(v.boolean()),
    // When the verification check last ran, and the error it hit (if any).
    lastVerificationCheckAt: v.optional(v.number()),
    lastVerificationError: v.optional(v.string()),
    // Legacy, from when the admin panel sent the setup notice itself. Nothing
    // writes these any more: the notice is composed and sent from a real
    // mailbox, so its record is that mailbox's Sent folder. Kept so existing
    // rows carrying them still validate.
    pendingNoticeSentAt: v.optional(v.number()),
    pendingNoticeCount: v.optional(v.number()),
    // Bring-your-own AWS: when set, all SES/S3/SNS calls for this domain use
    // the referenced AWS account's credentials and bucket. When undefined the
    // platform's shared AWS account is used (legacy behavior).
    awsAccountId: v.optional(v.id("awsAccounts")),
  })
    .index("by_user_id", ["userId"])
    .index("by_domain", ["domain"])
    .index("by_aws_account", ["awsAccountId"]),

  // User-connected AWS accounts for BYO (bring-your-own) infrastructure.
  // One row per (user, AWS account) pair. Populated after the user deploys
  // the Mailmark CloudFormation stack in their own AWS account and pastes
  // back the stack outputs.
  awsAccounts: defineTable({
    userId: v.id("users"),
    alias: v.string(),
    roleArn: v.string(),
    externalId: v.string(),
    region: v.string(),
    s3Bucket: v.string(),
    // The AWS webhook endpoints (inbound + sending-events) are authenticated
    // by a shared secret we bake into the CFN stack as a Lambda/SNS env var.
    // Per-account secret → we can distinguish which AWS account a request came from.
    webhookSecret: v.string(),
    awsAccountId: v.optional(v.string()),
    sesSandbox: v.optional(v.boolean()),
    status: v.union(
      v.literal("pending"),
      v.literal("verified"),
      v.literal("failed")
    ),
    lastError: v.optional(v.string()),
    lastVerifiedAt: v.optional(v.number()),
  })
    .index("by_user_id", ["userId"])
    .index("by_webhook_secret", ["webhookSecret"]),

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
    // Click tracking: recorded when recipient clicks a tracked link
    clickedLinks: v.optional(v.array(v.object({
      url: v.string(),
      clickedAt: v.number(),
    }))),
    // Reply tracking: set when a reply to this sent email is received
    repliedAt: v.optional(v.number()),
    // In-Reply-To header from inbound emails (for reply matching)
    inReplyTo: v.optional(v.string()),
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

  sequences: defineTable({
    userId: v.id("users"),
    domainId: v.id("domains"),
    mailboxId: v.id("mailboxes"),
    name: v.string(),
    status: v.union(v.literal("active"), v.literal("paused"), v.literal("completed")),
    steps: v.array(
      v.union(
        v.object({
          type: v.literal("send_email"),
          subject: v.string(),
          html: v.string(),
        }),
        v.object({
          type: v.literal("delay"),
          delayMs: v.number(),
        })
      )
    ),
    createdAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_domain_id", ["domainId"]),

  sequenceEnrollments: defineTable({
    sequenceId: v.id("sequences"),
    contactEmail: v.string(),
    mergeFields: v.optional(v.any()),
    currentStep: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("replied"),
      v.literal("cancelled"),
      v.literal("bounced")
    ),
    enrolledAt: v.number(),
    completedAt: v.optional(v.number()),
    lastStepAt: v.optional(v.number()),
    scheduledJobId: v.optional(v.string()),
  })
    .index("by_sequence_id", ["sequenceId"])
    .index("by_sequence_status", ["sequenceId", "status"])
    .index("by_sequence_email", ["sequenceId", "contactEmail"]),

  platformWarmupAccounts: defineTable({
    email: v.string(),
    provider: v.literal("gmail"),
    appPassword: v.string(),
    status: v.union(v.literal("active"), v.literal("paused")),
    dailySentCount: v.number(),
    dailyReceivedCount: v.number(),
    lastResetAt: v.number(),
    // Health of the Gmail credentials themselves. SMTP/IMAP failures used to
    // be logged and swallowed, so a revoked app password meant silent retries
    // every 30 minutes forever. These fields let the engine pull a broken
    // account out of rotation and tell an admin why.
    consecutiveFailures: v.optional(v.number()),
    lastFailureAt: v.optional(v.number()),
    lastFailureReason: v.optional(v.string()),
    autoPausedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_email", ["email"]),

  warmupMailboxes: defineTable({
    userId: v.id("users"),
    mailboxId: v.id("mailboxes"),
    domainId: v.id("domains"),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("completed")
    ),
    speed: v.union(v.literal("slow"), v.literal("normal"), v.literal("fast")),
    dailyLimit: v.number(),
    sentToday: v.number(),
    receivedToday: v.number(),
    currentDay: v.number(),
    healthScore: v.number(),
    inboxRate: v.number(),
    startedAt: v.number(),
    lastActivityAt: v.optional(v.number()),
    // Why warmup stopped, when it stopped on its own rather than by request.
    pausedReason: v.optional(v.string()),
    // Set when the ramp finished its full run. Warmup used to have no end: the
    // day counter climbed forever at a flat 20/day, so a mailbox stayed
    // enrolled until somebody noticed and paused it.
    completedAt: v.optional(v.number()),
  })
    .index("by_user_id", ["userId"])
    .index("by_mailbox_id", ["mailboxId"])
    .index("by_domain_id", ["domainId"])
    .index("by_status", ["status"]),

  warmupEmails: defineTable({
    warmupMailboxId: v.id("warmupMailboxes"),
    platformAccountId: v.id("platformWarmupAccounts"),
    direction: v.union(v.literal("outbound"), v.literal("inbound")),
    fromAddress: v.string(),
    toAddress: v.string(),
    messageId: v.string(),
    subject: v.string(),
    sentAt: v.number(),
    openedAt: v.optional(v.number()),
    repliedAt: v.optional(v.number()),
    repliedMessageId: v.optional(v.string()),
    placement: v.union(v.literal("inbox"), v.literal("spam"), v.literal("unknown")),
    rescuedFromSpam: v.optional(v.boolean()),
    markedImportant: v.optional(v.boolean()),
    // SES outcome for outbound warmup sends. Without the SES-assigned id there
    // is nothing for a bounce or complaint notification to match on, so warmup
    // bounces used to fall on the floor while still counting against the
    // sender's SES reputation. Inbound (Gmail SMTP) sends leave these unset.
    sesMessageId: v.optional(v.string()),
    deliveryStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("delivered"),
        v.literal("bounced"),
        v.literal("failed"),
        v.literal("complained")
      )
    ),
    bouncedAt: v.optional(v.number()),
    bounceReason: v.optional(v.string()),
  })
    .index("by_warmup_mailbox", ["warmupMailboxId"])
    // Scoring and history read one mailbox over a date window. Without the
    // date in the index they have to collect every warmup email the mailbox
    // ever sent and filter in memory, which grows without bound.
    .index("by_warmup_mailbox_and_date", ["warmupMailboxId", "sentAt"])
    .index("by_platform_account", ["platformAccountId"])
    .index("by_message_id", ["messageId"])
    .index("by_ses_message_id", ["sesMessageId"])
    .index("by_sent_date", ["sentAt"]),

  warmupContentTemplates: defineTable({
    category: v.union(
      v.literal("business"),
      v.literal("personal"),
      v.literal("newsletter"),
      v.literal("notification")
    ),
    subjects: v.array(v.string()),
    bodies: v.array(v.string()),
    replyBodies: v.array(v.string()),
  }),

  api_keys: defineTable({
    userId: v.id("users"),
    domainId: v.optional(v.id("domains")),
    name: v.string(),
    keyHash: v.string(),
    keyPrefix: v.string(),
    scope: v.optional(v.union(v.literal("domain"), v.literal("org"))),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_user_id", ["userId"])
    .index("by_key_hash", ["keyHash"]),
});
