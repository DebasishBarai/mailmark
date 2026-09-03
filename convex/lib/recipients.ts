import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { isPlausibleAddress } from "./sendPolicy";

/**
 * The user's audience: every distinct address they have mailed.
 *
 * This is the number a plan should be sized on. convex/contacts.ts measures
 * something else entirely, and production made the gap plain: an account that
 * had sent to thousands of people held 18 contacts, because contacts only
 * gains a row when someone writes *to* them with a display name. CSV mail
 * merges and sequence enrollments never passed through it.
 *
 * Recording is idempotent, and that is what makes the whole thing work. The
 * recipients table is its own dedup structure via by_user_email, so a second
 * send to the same address is a lookup and nothing else, the backfill can be
 * re-run over mail it has already walked without double counting, and a live
 * send during a backfill needs no reconciliation: both paths come through
 * here, and only an actual insert moves recipientCount.
 */

/** Addresses that must never enter an audience count. */
function normalize(email: string): string | null {
  const address = email.trim().toLowerCase();
  if (!address) return null;
  // Same gate the contacts path verifies against, so a malformed header value
  // or an empty CSV cell cannot become a billable audience member.
  if (!isPlausibleAddress(address)) return null;
  return address;
}

/**
 * Record every address in `emails` as part of `userId`'s audience.
 * Returns how many were new, which is also how far recipientCount moved.
 */
export async function recordRecipients(
  ctx: MutationCtx,
  userId: Id<"users">,
  emails: (string | undefined)[]
): Promise<number> {
  // Dedup within the call first: one mail merge row can carry the same address
  // in both to and cc, and that is one audience member, not two.
  const addresses = new Set<string>();
  for (const raw of emails) {
    if (!raw) continue;
    const address = normalize(raw);
    if (address) addresses.add(address);
  }
  if (addresses.size === 0) return 0;

  let added = 0;
  for (const email of addresses) {
    const existing = await ctx.db
      .query("recipients")
      .withIndex("by_user_email", (q) => q.eq("userId", userId).eq("email", email))
      .unique();
    if (existing) continue;

    await ctx.db.insert("recipients", { userId, email, firstSeenAt: Date.now() });
    added += 1;
  }

  if (added > 0) {
    const user = await ctx.db.get(userId);
    if (user) {
      await ctx.db.patch(userId, { recipientCount: (user.recipientCount ?? 0) + added });
    }
  }
  return added;
}

/** recordRecipients for a send, which knows its mailbox rather than its user. */
export async function recordRecipientsForMailbox(
  ctx: MutationCtx,
  mailboxId: Id<"mailboxes">,
  emails: (string | undefined)[]
): Promise<number> {
  const mailbox = await ctx.db.get(mailboxId);
  if (!mailbox) return 0;
  return await recordRecipients(ctx, mailbox.userId, emails);
}
