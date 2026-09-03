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
    // Delivery tracking: set when SES delivery notification is received.
    //
    // "failed" is a permanent (hard) bounce and "bounced" a transient one:
    // that mapping is set in app/api/ses-webhook/route.ts and is why the
    // production snapshot shows 643 failed against 163 bounced. Only the
    // permanent ones feed suppression.
    //
    // "complained" and "blocked" are new. Complaints used to be dropped for
    // ordinary mail because there was no status to record them in, which cost
    // us the strongest reputation signal SES gives. "blocked" marks a message
    // the eligibility gate refused: the row is kept, never deleted, so a
    // blocked send stays queryable alongside the reason.
    deliveryStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("delivered"),
      v.literal("failed"),
      v.literal("bounced"),
      v.literal("complained"),
      v.literal("blocked")
    )),
    deliveredAt: v.optional(v.number()),
    // What the receiving server actually said. Without these we can count
    // failures but cannot tell a dead mailbox ("550 5.1.1 user unknown") from
    // a policy rejection ("550 5.7.1 blocked"), which are opposite problems:
    // the first means the list is stale, the second means our reputation is.
    bounceType: v.optional(v.string()),
    bounceSubType: v.optional(v.string()),
    diagnosticCode: v.optional(v.string()),
    bouncedAt: v.optional(v.number()),
    complainedAt: v.optional(v.number()),
    // Why the gate refused this message, mirroring the sendBlocks row.
    blockedAt: v.optional(v.number()),
    blockReason: v.optional(v.string()),
    blockDetail: v.optional(v.string()),
    // How many times a scheduled send has been held (verifier unreachable, a
    // verification still in flight, the kill switch on). Bounded so a message
    // cannot be re-armed forever.
    holdCount: v.optional(v.number()),
    lastHeldAt: v.optional(v.number()),
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
    // Every stats reader wanted "this mailbox's sent mail since <date>" but
    // by_mailbox_folder stops at the folder, so they collected the whole
    // folder and threw away everything outside the window in memory. That is
    // unbounded work for a bounded answer, and it is what put these queries on
    // course for the 32,000 document scan cap.
    .index("by_mailbox_folder_date", ["mailboxId", "folder", "date"])
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
    .index("by_domain_id", ["domainId"])
    // Lets the 7 and 30 day figures on the unsubscribes page be range reads
    // rather than a collect of every unsubscribe the domain has ever had.
    .index("by_domain_date", ["domainId", "unsubscribedAt"]),

  // Cached per-address verification results.
  //
  // This table predates MillionVerifier: it held the outcome of a syntax check
  // and an MX lookup, which is a check on the *domain*, not the mailbox. Every
  // one of the 643 addresses that hard bounced with "mailbox does not exist"
  // passed it, because their domains resolve and answer mail perfectly well.
  // The DNS fields are kept (old rows still carry them, and a syntax failure is
  // still worth short-circuiting on) but the field that now decides a send is
  // `result`, which comes from MillionVerifier and speaks about the mailbox.
  //
  // Rows are never scoped to a user. An address either accepts mail or it does
  // not, and that fact costs money to establish, so it is shared platform-wide.
  // Suppression, which *is* a per-account judgement, lives in its own table.
  emailVerifications: defineTable({
    email: v.string(),
    isValid: v.boolean(),
    syntaxValid: v.boolean(),
    mxValid: v.boolean(),
    reason: v.optional(v.string()),
    checkedAt: v.number(),
    // MillionVerifier's verdict, verbatim, plus "error" for a lookup we could
    // not complete. Optional because rows written by the old DNS-only path
    // have no such verdict and must still validate.
    result: v.optional(v.union(
      v.literal("ok"),
      v.literal("catch_all"),
      v.literal("unknown"),
      v.literal("invalid"),
      v.literal("disposable"),
      v.literal("error")
    )),
    // MillionVerifier's own sub-classification (e.g. "invalid_mx",
    // "disposable", "role_account"), kept verbatim for diagnosis.
    subResult: v.optional(v.string()),
    // Which lookup produced this row. "dns" marks the legacy rows so a reader
    // can tell a real mailbox check from the old domain-level guess.
    provider: v.optional(v.union(
      v.literal("millionverifier"),
      v.literal("millionverifier_bulk"),
      v.literal("dns")
    )),
    // Contact data decays at roughly 2% a month, so a result is a measurement
    // with an age, not a fact. expiresAt is checkedAt plus the TTL that was in
    // force when the row was written; the gate compares against it rather than
    // recomputing, so shortening the TTL later does not silently revalidate
    // the whole table at once.
    expiresAt: v.optional(v.number()),
    // Set while an async re-verification is in flight, so a hundred queued
    // messages to the same stale address schedule one lookup rather than one
    // each.
    refreshStartedAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    // Lets the revalidation sweep read only what has actually expired instead
    // of scanning every address we have ever checked.
    .index("by_expires_at", ["expiresAt"]),

  // Addresses that must never be sent to again for a given account.
  //
  // This is the signal that outranks every other check in the gate. A hard
  // bounce or a spam complaint is evidence from the receiving mail server
  // itself, which beats any prediction a verification API can sell us, so a
  // row here blocks a send even when a fresh "ok" verification exists.
  //
  // Scoped per user, not platform-wide: a complaint is a statement about one
  // sender's relationship with one recipient, and one account's bad list must
  // not silently censor another account's legitimate one.
  //
  // Transient bounces (mailbox full, greylisting, temporary server failure) do
  // NOT belong here. They say nothing about whether the address exists, and
  // suppressing on them would permanently discard valid recipients over a
  // mailbox that was full for an afternoon.
  suppressions: defineTable({
    userId: v.id("users"),
    email: v.string(),
    reason: v.union(
      v.literal("hard_bounce"),
      v.literal("complaint"),
      v.literal("manual"),
      v.literal("invalid"),
      v.literal("disposable")
    ),
    createdAt: v.number(),
    // The SES evidence that produced this row, kept so we can answer whether
    // our failures are dead mailboxes or policy rejections. bounceSubType
    // separates "General" from "Suppressed"/"OnAccountSuppressionList", and
    // the SMTP diagnostic code carries the receiving server's own words
    // ("550 5.1.1 user unknown" against "550 5.7.1 blocked").
    bounceType: v.optional(v.string()),
    bounceSubType: v.optional(v.string()),
    diagnosticCode: v.optional(v.string()),
    // Which SES message taught us this, for tracing back.
    sesMessageId: v.optional(v.string()),
    // Set when an operator deliberately lifts a suppression. The row is kept
    // rather than deleted so the history of why an address was blocked, and
    // who un-blocked it, survives.
    releasedAt: v.optional(v.number()),
    releasedReason: v.optional(v.string()),
  })
    .index("by_user_email", ["userId", "email"])
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_email", ["email"]),

  // Every send the gate refused, and why.
  //
  // Blocked messages must stay queryable, and a refusal on the compose or API
  // path has no row in the emails table to record itself against, so the
  // decision is logged here regardless of which path made it. Nothing deletes
  // from this table.
  sendBlocks: defineTable({
    userId: v.id("users"),
    email: v.string(),
    // Which gate check refused. Mirrors BLOCK_REASONS in lib/sendPolicy.ts.
    reason: v.string(),
    // Human-readable detail: the diagnostic code behind a suppression, the
    // MillionVerifier verdict behind a verification block.
    detail: v.optional(v.string()),
    // Which send path was refused, for working out where bad addresses enter.
    path: v.union(
      v.literal("compose"),
      v.literal("scheduled"),
      v.literal("api"),
      v.literal("sequence")
    ),
    blockedAt: v.number(),
    mailboxId: v.optional(v.id("mailboxes")),
    // The outbox row this refusal belongs to, when there is one.
    emailId: v.optional(v.id("emails")),
    messageId: v.optional(v.string()),
    batchId: v.optional(v.string()),
  })
    .index("by_user_blocked_at", ["userId", "blockedAt"])
    .index("by_user_email", ["userId", "email"])
    .index("by_email_id", ["emailId"])
    .index("by_reason", ["reason", "blockedAt"]),

  // The kill switch, and anything else that has to be changeable without a
  // deploy. Singleton: one row, name = "global".
  sendingControls: defineTable({
    name: v.string(),
    // The kill switch. When true every user-facing send path refuses at the
    // gate and the message is held, not dropped: scheduled mail stays in the
    // outbox with its job re-armed, so lifting the switch resumes the queue.
    sendingPaused: v.boolean(),
    pausedReason: v.optional(v.string()),
    pausedAt: v.optional(v.number()),
    pausedBy: v.optional(v.string()),
    // Warmup is halted separately. It goes to platform-controlled mailboxes,
    // carries no list risk, and stopping it mid-ramp costs domain reputation
    // that takes weeks to rebuild, so "stop the queue while the backfill runs"
    // should not stop it by default.
    warmupPaused: v.optional(v.boolean()),
    // Runtime overrides for lib/sendPolicy.ts. Absent means the code default.
    // These exist so the catch-all decision can be flipped from the dashboard
    // when a bounce rate starts climbing, rather than waiting for a deploy.
    catchAllPolicy: v.optional(v.union(v.literal("allow"), v.literal("block"))),
    unknownPolicy: v.optional(v.union(v.literal("allow"), v.literal("block"))),
    onVerifierUnavailable: v.optional(
      v.union(v.literal("hold"), v.literal("send"))
    ),
    verificationTtlDays: v.optional(v.number()),
  }).index("by_name", ["name"]),

  // State for the MillionVerifier bulk backfill.
  //
  // The single-address API is charged per lookup and the bulk endpoint is far
  // cheaper per address, so the 22,024 addresses already queued go through
  // bulk. One row per submitted file, plus one row (kind = "walk") holding the
  // cursor for the outbox scan that collects them: the outbox is 40,000+ rows
  // and a transaction may scan 32,000, so the scan is paged across many
  // transactions and its position lives here.
  verificationBatches: defineTable({
    kind: v.union(v.literal("walk"), v.literal("file")),
    // Identifies one backfill run, so a second run started by mistake cannot
    // tally into the first one's state.
    runId: v.string(),
    status: v.union(
      v.literal("collecting"),
      v.literal("uploading"),
      v.literal("processing"),
      v.literal("applying"),
      v.literal("done"),
      v.literal("failed")
    ),
    // walk rows only: where the outbox scan has reached.
    //
    // The emails table is indexed by (mailboxId, folder) and there is no
    // global "everything in the outbox" index, so the scan is two nested
    // walks: a page of mailboxes at a time, and within each mailbox a page of
    // its outbox at a time. Both positions have to survive between
    // transactions, hence three cursors rather than one.
    //
    // mailboxCursor is a creation-time watermark (the _creationTime of the
    // last mailbox queued, as a string), or the literal "DONE" once the
    // listing is exhausted - distinguishable from "not started" (undefined) in
    // a way a null cursor is not. It is not a Convex pagination cursor:
    // Convex permits one paginate() per transaction and the outbox read spends
    // it, so the mailbox listing uses take() with this watermark instead.
    mailboxCursor: v.optional(v.string()),
    emailCursor: v.optional(v.string()),
    currentMailboxId: v.optional(v.id("mailboxes")),
    // Mailboxes from the current page that have not been walked yet, drained
    // one per step.
    mailboxQueue: v.optional(v.array(v.id("mailboxes"))),
    // Addresses collected but not yet submitted. Bounded by BULK_BATCH_SIZE in
    // verificationBackfill.ts and flushed to a file row when it fills, so this
    // never grows towards the 16 MiB document read limit.
    pending: v.optional(v.array(v.string())),
    // file rows only: MillionVerifier's handle for the uploaded list, and how
    // far applying its results has got.
    fileId: v.optional(v.string()),
    emails: v.optional(v.array(v.string())),
    appliedCount: v.optional(v.number()),
    total: v.optional(v.number()),
    startedAt: v.number(),
    updatedAt: v.number(),
    finishedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    // Counts for reporting: how the submitted addresses came back.
    resultCounts: v.optional(v.any()),
  })
    .index("by_kind_status", ["kind", "status"])
    .index("by_run", ["runId"])
    .index("by_file_id", ["fileId"]),

  // SES sending events that arrived before the message row they describe.
  //
  // sendEmail calls SES, then writes to S3, then inserts the emails row.
  // A hard bounce from a dead mailbox comes back in well under a second, so
  // the notification regularly lost that race, found no row to update, logged
  // "no email found", and was dropped. That is how 15 messages have sat in
  // pending since March. Events that cannot be matched are parked here and
  // replayed instead of discarded.
  pendingDeliveryEvents: defineTable({
    sesMessageId: v.string(),
    status: v.string(),
    timestamp: v.number(),
    reason: v.optional(v.string()),
    bounceType: v.optional(v.string()),
    bounceSubType: v.optional(v.string()),
    diagnosticCode: v.optional(v.string()),
    recipients: v.optional(v.array(v.string())),
    receivedAt: v.number(),
    attempts: v.number(),
    // Set once the event has been matched to a message and applied. Kept
    // rather than deleted so a replayed event can be traced.
    resolvedAt: v.optional(v.number()),
  })
    .index("by_ses_message_id", ["sesMessageId"])
    .index("by_resolved_received", ["resolvedAt", "receivedAt"]),

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
    .index("by_domain_id", ["domainId"])
    // markRepliedByEmail runs on every inbound reply and used .filter() on
    // mailboxId, which scans the whole table. Sequence rows carry full HTML
    // email bodies inline in steps[], so that scan was reading megabytes on a
    // hot path to find at most a handful of rows.
    .index("by_mailbox_id", ["mailboxId"]),

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
    // Sending health. A mailbox whose every send fails (SES still in sandbox,
    // sending disabled, identity not usable) used to look identical to one
    // warming perfectly: active, day climbing, health 100, and nothing sent.
    // How many recent sends actually produced a placement answer. A score of
    // 100 computed from nothing looks identical to a genuinely healthy
    // mailbox, so the dashboard needs to know which one it is looking at.
    placementSamples: v.optional(v.number()),
    consecutiveSendFailures: v.optional(v.number()),
    lastSendError: v.optional(v.string()),
    lastSendErrorAt: v.optional(v.number()),
    lastSuccessfulSendAt: v.optional(v.number()),
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
    // Whether the engagement round still has work to do on this message.
    // Set explicitly at insert rather than inferred from the absence of
    // openedAt, so the query that drives engagement is a plain index range on
    // a value we always write. Outbound only: inbound warmup is not engaged
    // with from our side.
    engagementState: v.optional(
      v.union(v.literal("pending"), v.literal("done"))
    ),
  })
    .index("by_warmup_mailbox", ["warmupMailboxId"])
    // Scoring and history read one mailbox over a date window. Without the
    // date in the index they have to collect every warmup email the mailbox
    // ever sent and filter in memory, which grows without bound.
    .index("by_warmup_mailbox_and_date", ["warmupMailboxId", "sentAt"])
    .index("by_platform_account", ["platformAccountId"])
    .index("by_message_id", ["messageId"])
    .index("by_ses_message_id", ["sesMessageId"])
    .index("by_engagement_state", ["engagementState", "sentAt"])
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

  // Per-mailbox denormalized counts.
  //
  // The platformCounters table below holds one row per platform-wide counter.
  // These are the same idea scoped to a mailbox, and they get their own table
  // rather than dynamic keys in platformCounters because there is one row per
  // mailbox: a single row read answers every count a mailbox page needs, and
  // the nightly rebuild can recompute one mailbox at a time instead of holding
  // a per-mailbox tally for the whole platform in one document.
  //
  // All figures are all-time, matching what emailStats.getForCurrentUser
  // produced when it read every email the user owned.
  mailboxStats: defineTable({
    mailboxId: v.id("mailboxes"),
    // An array of {folder, count} rather than a {[folder]: count} map.
    // Convex field names may only contain alphanumerics and underscores, and
    // folder is a free-form string that moveToFolder accepts straight from the
    // client, so using folder names as object keys would let a caller write a
    // document Convex rejects. Storing them as values keeps any folder name
    // legal.
    byFolder: v.array(v.object({ folder: v.string(), count: v.number() })),
    // Inbox messages with read === false.
    unread: v.number(),
    // The next five are over folder === "sent" only, which is the scope
    // emailStats has always reported them in. pending means a sent message
    // whose deliveryStatus is none of delivered/failed/bounced, including one
    // that has no deliveryStatus at all.
    delivered: v.number(),
    failed: v.number(),
    bounced: v.number(),
    pending: v.number(),
    opened: v.number(),
  }).index("by_mailbox", ["mailboxId"]),

  // Per-domain denormalized counts. Currently only unsubscribes, whose totals
  // are all-time and so cannot be answered by the by_domain_date range read.
  domainStats: defineTable({
    domainId: v.id("domains"),
    unsubscribesTotal: v.number(),
    // Values, not keys, for the same reason as byFolder above, and here it is
    // not hypothetical: "one-click" contains a hyphen, which is not a legal
    // Convex field name, so a map keyed by source would throw on every
    // one-click unsubscribe.
    unsubscribesBySource: v.array(
      v.object({ source: v.string(), count: v.number() })
    ),
  }).index("by_domain", ["domainId"]),

  // Denormalized platform-wide counters.
  //
  // platformStats.getStats and getAdminStats used to derive every number by
  // .collect()ing whole tables and calling .length on the result, which reads
  // every document in full just to count it. That crosses Convex's per
  // transaction caps (32,000 documents scanned, 16 MiB read) as the platform
  // grows, and a crossed cap makes the query throw rather than degrade.
  //
  // One row per counter key rather than a single wide row: independent
  // counters then never contend on the same document, and because Convex
  // tracks read dependencies per index range, a query reading only
  // "emails.total" is not invalidated when "sequences.active" is written.
  //
  // Values are maintained incrementally by convex/lib/counters.ts, called from
  // every mutation that creates, deletes, or changes a counted field, and
  // recomputed from scratch nightly by platformStats.startCounterReconcile.
  platformCounters: defineTable({
    key: v.string(),
    value: v.number(),
  }).index("by_key", ["key"]),

  // Walk state for the paginated counter reconcile. A full recount cannot
  // .collect() the tables it is counting (that is the limit being worked
  // around), so it pages through them across many transactions and keeps its
  // cursor here. Singleton: one row, name = "reconcile".
  platformCounterState: defineTable({
    name: v.string(),
    // Identifies one reconcile run. A step whose runId no longer matches the
    // stored one has been superseded by a newer run and stops, so a cron
    // firing on top of a manual recount cannot double count.
    runId: v.string(),
    // Rows created at or after this instant are left to the live counter
    // hooks, so the walk and the hooks cannot both count the same row.
    t0: v.number(),
    tableIndex: v.number(),
    cursor: v.optional(v.string()),
    // Running total for this walk, and the counter values as they stood when
    // the walk began. Both are flat {key: number} maps of ~30 entries.
    tally: v.any(),
    snapshot: v.any(),
    pages: v.number(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  }).index("by_name", ["name"]),

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
