import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  buildDomainPendingNotice,
  noticeInputFromDomain,
} from "./lib/domainNotice";
import {
  K,
  bumpCounters,
  countChanged,
  countCreated,
  countRemoved,
  deleteDomainStats,
  domainBuckets,
} from "./lib/counters";
import {
  query,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";

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

    return await ctx.db
      .query("domains")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const getById = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const domain = await ctx.db.get(domainId);
    if (!domain) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || domain.userId !== user._id) return null;

    // The domain detail page renders the DNS record set the customer has to
    // publish, and every SES endpoint in it is region-scoped. It used to
    // hardcode ap-south-1, which was silently wrong for any BYO-AWS domain in
    // another region: the page told the customer to point at an endpoint the
    // verifier would never accept, so the row could not go green no matter how
    // faithfully they followed it. Send the real region down with the row.
    // return domain;
    return { ...domain, region: await regionForDomain(ctx, domain) };
  },
});

// ── Internal helpers ──

export const getDomainByName = internalQuery({
  args: { domain: v.string() },
  handler: async (ctx, { domain }) => {
    return await ctx.db
      .query("domains")
      .withIndex("by_domain", (q) => q.eq("domain", domain))
      .unique();
  },
});

export const insertDomain = internalMutation({
  args: {
    userId: v.id("users"),
    domain: v.string(),
    sesVerificationToken: v.optional(v.string()),
    sesDkimTokens: v.optional(v.array(v.string())),
    awsAccountId: v.optional(v.id("awsAccounts")),
  },
  handler: async (ctx, args) => {
    const domainId = await ctx.db.insert("domains", {
      userId: args.userId,
      domain: args.domain,
      verified: false,
      mxVerified: false,
      spfVerified: false,
      dkimVerified: false,
      dmarcVerified: false,
      sesVerificationToken: args.sesVerificationToken,
      sesDkimTokens: args.sesDkimTokens,
      awsAccountId: args.awsAccountId,
    });
    const inserted = await ctx.db.get(domainId);
    if (inserted) await countCreated(ctx, domainBuckets(inserted));
    return domainId;
  },
});

// Fetch the awsAccounts row for a domain, if any. Returns null for
// platform-hosted domains (awsAccountId unset).
export const getAwsAccountForDomain = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    const domain = await ctx.db.get(domainId);
    if (!domain?.awsAccountId) return null;
    return await ctx.db.get(domain.awsAccountId);
  },
});

// Look up the AWS account for a domain-by-name. Used by operations that
// only have an S3 key (which starts with `{domain}/...`) to figure out
// which AWS account owns the object.
export const getAwsAccountByDomainName = internalQuery({
  args: { domain: v.string() },
  handler: async (ctx, { domain }) => {
    const row = await ctx.db
      .query("domains")
      .withIndex("by_domain", (q) => q.eq("domain", domain))
      .unique();
    if (!row?.awsAccountId) return null;
    return await ctx.db.get(row.awsAccountId);
  },
});

export const updateVerification = internalMutation({
  args: {
    domainId: v.id("domains"),
    verified: v.boolean(),
    mxVerified: v.boolean(),
    spfVerified: v.boolean(),
    dkimVerified: v.boolean(),
    dmarcVerified: v.boolean(),
    dkimRecordStatus: v.optional(v.array(v.boolean())),
    actualMxValue: v.optional(v.string()),
    actualSpfValue: v.optional(v.string()),
    actualDmarcValue: v.optional(v.string()),
    mailFromMxVerified: v.optional(v.boolean()),
    mailFromSpfVerified: v.optional(v.boolean()),
    // Raw SES statuses, so the admin panel can tell Pending from Failed.
    sesDkimStatus: v.optional(v.string()),
    sesMailFromStatus: v.optional(v.string()),
    sesVerifiedForSending: v.optional(v.boolean()),
    lastVerificationCheckAt: v.optional(v.number()),
    lastVerificationError: v.optional(v.string()),
  },
  handler: async (ctx, { domainId, ...status }) => {
    // `verified` flips here, which moves the domain in and out of the
    // domains.verified counter that the public landing page reads.
    const before = await ctx.db.get(domainId);
    if (!before) return;
    await ctx.db.patch(domainId, status);
    const after = await ctx.db.get(domainId);
    if (after) await countChanged(ctx, domainBuckets(before), domainBuckets(after));
  },
});

export const markReceiptRuleCreated = internalMutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    await ctx.db.patch(domainId, { sesReceiptRuleCreated: true });
  },
});

export const listForCurrentUserInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("domains")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getUserByClerkId = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
  },
});

export const getByIdInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    return await ctx.db.get(domainId);
  },
});

export const deleteDomainCascade = internalMutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    // Delete all mailboxes for this domain
    const mailboxes = await ctx.db
      .query("mailboxes")
      .withIndex("by_domain_id", (q) => q.eq("domainId", domainId))
      .collect();

    for (const mb of mailboxes) {
      // Old: read every message in the mailbox into this transaction and
      // delete them here. That is the unbounded read that broke the send
      // quota, and a domain with a busy mailbox could not be deleted at all
      // because the mutation died before it reached the domain row.
      //
      // const emails = await ctx.db
      //   .query("emails")
      //   .withIndex("by_mailbox_folder", (q) => q.eq("mailboxId", mb._id))
      //   .collect();
      // await deleteEmailsCounted(ctx, emails);
      //
      // The mailbox row goes now, so the domain disappears from the user's
      // account immediately, and its mail is swept in scheduled batches after.
      // Nothing is waiting on that sweep, and emails are indexed by mailboxId,
      // which keeps working once the mailbox row is gone. The sweep drops the
      // stats row when it finishes, so deleteMailboxStats is not called here.
      await ctx.db.delete(mb._id);
      await ctx.scheduler.runAfter(0, internal.emails.sweepMailboxEmails, {
        mailboxId: mb._id,
      });
    }
    // One counter write for the whole set, for the same reason the emails
    // above are tallied rather than counted one at a time.
    await bumpCounters(ctx, { [K.mailboxesTotal]: -mailboxes.length });

    const domainDoc = await ctx.db.get(domainId);
    await ctx.db.delete(domainId);
    if (domainDoc) await countRemoved(ctx, domainBuckets(domainDoc));
    await deleteDomainStats(ctx, domainId);
  },
});

/** Rows either verification sweep reads in one pass. */
const DOMAIN_SWEEP_BATCH = 200;

export const listUnverifiedOlderThan = internalQuery({
  args: { cutoffTime: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, { cutoffTime, limit }) => {
    // Old: no index at all, so this read the entire domains table and threw
    // away every verified row, then every row inside the cutoff. Same shape as
    // the quota scan, just against a table that is small today.
    //
    // return await ctx.db.query("domains").filter((q) => q.and(
    //   q.eq(q.field("verified"), false),
    //   q.lt(q.field("_creationTime"), cutoffTime)
    // )).collect();
    //
    // A Convex index orders by _creationTime after its own fields, so the
    // unverified range arrives oldest first. The rows this wants are therefore
    // at the front of it, and a bounded batch off the front is enough: the
    // caller is a daily cron, so anything left waits for tomorrow.
    const oldest = await ctx.db
      .query("domains")
      .withIndex("by_verified", (q) => q.eq("verified", false))
      .take(limit ?? DOMAIN_SWEEP_BATCH);

    return oldest.filter((d) => d._creationTime < cutoffTime);
  },
});

// Domains still waiting on SES, used by the hourly re-verification cron.
// Scoped to recently created rows: a domain that has sat unverified for
// weeks is never going to flip on its own, and polling it forever would
// burn SES rate limit that pending domains need.
export const listPendingVerification = internalQuery({
  args: { createdAfter: v.number(), limit: v.number() },
  handler: async (ctx, { createdAfter, limit }) => {
    // Old: no index, so .take(limit) bounded what came back but not what was
    // read. A filtered scan keeps reading until it has enough matches, which
    // on a table where few rows match means reading all of it.
    //
    // return await ctx.db.query("domains").filter((q) => q.and(
    //   q.eq(q.field("verified"), false),
    //   q.gt(q.field("_creationTime"), createdAfter)
    // )).take(limit);
    //
    // Newest first, because every row inside the window sorts ahead of every
    // row outside it, so a bounded take off that end is all matches and no
    // waste.
    //
    // This does change which domains a run polls when there are more inside
    // the window than the batch size. The old scan read the table in creation
    // order and took the first matches it found, which were the oldest inside
    // the window; this takes the newest. Either way the surplus waits for a
    // later run, and newest first is what the window is for: it exists
    // because a domain that has sat unverified for weeks is not going to flip
    // on its own, so the recently created ones are the ones worth asking SES
    // about.
    const newest = await ctx.db
      .query("domains")
      .withIndex("by_verified", (q) => q.eq("verified", false))
      .order("desc")
      .take(limit);

    return newest.filter((d) => d._creationTime > createdAfter);
  },
});

// ── Admin ──

async function isAdminUser(ctx: QueryCtx): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) return false;
  const clerkId = identity.subject;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();
  return user?.category === "admin";
}

async function requireAdminUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) throw new Error("Admin access required");
  const clerkId = identity.subject;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();
  if (!user || user.category !== "admin") throw new Error("Admin access required");
  return user;
}

// Every domain on the platform with its owner, newest first. Admin only.
export const listAllForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminUser(ctx);

    const domains = await ctx.db.query("domains").order("desc").collect();

    return await Promise.all(
      domains.map(async (domain) => {
        const owner = await ctx.db.get(domain.userId);
        return {
          ...domain,
          ownerEmail: owner?.email ?? null,
          ownerName: owner?.name ?? null,
        };
      })
    );
  },
});

// The region whose SES endpoints a domain's DNS records must point at. BYO
// domains use their own account's region, platform domains the shared one.
async function regionForDomain(
  ctx: QueryCtx,
  domain: { awsAccountId?: Id<"awsAccounts"> }
): Promise<string> {
  if (domain.awsAccountId) {
    const account = await ctx.db.get(domain.awsAccountId);
    if (account) return account.region;
  }
  return process.env.AWS_REGION ?? "ap-south-1";
}

// Preview of the setup notice for a domain, so an admin can read exactly what
// the customer would receive before deciding to send it. Admin only.
export const pendingNoticePreview = query({
  args: { domainId: v.id("domains"), note: v.optional(v.string()) },
  handler: async (ctx, { domainId, note }) => {
    // Returns null rather than throwing for non-admins: the mailbox compose
    // page runs this off a URL parameter that any signed-in user could type,
    // and a thrown query there would surface as a crashed page.
    if (!(await isAdminUser(ctx))) return null;

    const domain = await ctx.db.get(domainId);
    if (!domain) return null;

    const owner = await ctx.db.get(domain.userId);
    const region = await regionForDomain(ctx, domain);
    const notice = buildDomainPendingNotice(
      noticeInputFromDomain(domain, region),
      { note, domainUrl: `${process.env.APP_URL ?? "https://www.mailmark.dev"}/domains/${domainId}` }
    );

    return {
      ...notice,
      alreadyVerified: domain.verified,
      recipient: owner?.email ?? null,
      sentAt: domain.pendingNoticeSentAt,
      sentCount: domain.pendingNoticeCount ?? 0,
    };
  },
});

export const getOwnerForDomain = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    const domain = await ctx.db.get(domainId);
    if (!domain) return null;
    const owner = await ctx.db.get(domain.userId);
    const region = await regionForDomain(ctx, domain);
    return { domain, owner, region };
  },
});

export const recordPendingNoticeSent = internalMutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    const domain = await ctx.db.get(domainId);
    if (!domain) return;
    await ctx.db.patch(domainId, {
      pendingNoticeSentAt: Date.now(),
      pendingNoticeCount: (domain.pendingNoticeCount ?? 0) + 1,
    });
  },
});

// The mailbox support mail is composed from. This is always the
// SUPPORT_FROM_EMAIL address (support@mailmark.dev unless overridden), owned
// by the admin. There is deliberately no fallback to another mailbox: sending
// a support notice from whatever other address happened to exist would be
// worse than not sending it, so a missing mailbox surfaces as an error the
// admin can act on. Admin only.
export const supportMailbox = query({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdminUser(ctx);

    const supportAddress = (
      process.env.SUPPORT_FROM_EMAIL ?? "support@mailmark.dev"
    ).toLowerCase();

    const mailbox = await ctx.db
      .query("mailboxes")
      .withIndex("by_full_address", (q) => q.eq("fullAddress", supportAddress))
      .unique();

    if (!mailbox) {
      return { supportAddress, mailboxId: null, reason: "missing" as const };
    }
    if (mailbox.userId !== admin._id) {
      return { supportAddress, mailboxId: null, reason: "not-owned" as const };
    }

    return { supportAddress, mailboxId: mailbox._id, reason: null };
  },
});
