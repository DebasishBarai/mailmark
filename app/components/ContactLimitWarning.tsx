"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Banner shown when the account is at or over the contact allowance for its
 * plan. Styled to match the DNS banners on the domain detail page so the two
 * read as the same kind of notice: blue while approaching the allowance, amber
 * once past it.
 *
 * "Contacts" here is the recipients count, the same number the /audience page
 * puts against the plan limit: every distinct address the user has mailed.
 * The contacts table is the reply derived address book and carries no plan
 * limit, so counting it would warn on the wrong number.
 *
 * Nothing enforces the cap yet (see PLAN_LIMITS in convex/quotas.ts), so the
 * copy is careful to say that sending is not blocked and nothing was removed.
 */

/** Fraction of the allowance at which the heads up appears. 0.8 leaves a fifth
 *  of the plan as runway, which is enough notice to upgrade before crossing
 *  over on an account that grows by a CSV import at a time. */
const APPROACHING_THRESHOLD = 0.8;

// Full class strings rather than pieces assembled at runtime, since Tailwind
// only sees literals in the source.
const TONES = {
  approaching: {
    box: "mb-8 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-900/20",
    icon: "mt-0.5 h-5 w-5 shrink-0 text-blue-500",
    title: "text-sm font-medium text-blue-800 dark:text-blue-300",
    body: "mt-0.5 text-xs text-blue-600 dark:text-blue-400",
    primaryLink:
      "text-xs font-medium text-blue-800 underline underline-offset-2 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200",
    secondaryLink:
      "text-xs font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200",
    // Circled "i", the same glyph the domain page uses for its blue notice.
    path: "M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z",
  },
  over: {
    box: "mb-8 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20",
    icon: "mt-0.5 h-5 w-5 shrink-0 text-amber-500",
    title: "text-sm font-medium text-amber-800 dark:text-amber-300",
    body: "mt-0.5 text-xs text-amber-600 dark:text-amber-400",
    primaryLink:
      "text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200",
    secondaryLink:
      "text-xs font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200",
    // Warning triangle.
    path: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z",
  },
} as const;

export default function ContactLimitWarning() {
  const usage = useQuery(api.quotas.getUsageAndLimits);

  // undefined while the query is in flight, null when signed out.
  if (!usage) return null;

  const limit = usage.limits.recipients;
  const count = usage.usage.recipients;

  // null limit means unlimited on this plan.
  if (limit === null) return null;

  // Old: if (count <= limit) return null, ie the banner only ever appeared
  // after the allowance had already been passed. The heads up below gives the
  // user a chance to act before that.
  const state =
    count > limit
      ? "over"
      : count >= limit * APPROACHING_THRESHOLD
        ? "approaching"
        : null;
  if (state === null) return null;

  const tone = TONES[state];
  // Old: Math.round, which rounded 9,999 of 10,000 up to a flat "100%" while
  // the account was still inside its allowance. Flooring only ever reads 100%
  // once the count has actually reached the limit.
  const pct = Math.min(100, Math.floor((count / limit) * 100));

  return (
    <div className={tone.box}>
      <svg
        className={tone.icon}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={tone.path} />
      </svg>
      <div>
        {state === "over" ? (
          <>
            <p className={tone.title}>
              You have {count.toLocaleString()} contacts, above the{" "}
              {limit.toLocaleString()} included in your {usage.plan} plan.
            </p>
            <p className={tone.body}>
              Nothing is blocked and no contact has been removed. You can keep sending
              as usual. Upgrading raises the allowance and keeps your account inside
              its plan.
            </p>
          </>
        ) : (
          <>
            <p className={tone.title}>
              {count === limit
                ? `You have used all ${limit.toLocaleString()} contacts included in your ${usage.plan} plan.`
                : `You have used ${pct}% of the contacts included in your ${usage.plan} plan.`}
            </p>
            <p className={tone.body}>
              {count.toLocaleString()} of {limit.toLocaleString()} contacts. Nothing
              is blocked when you pass the allowance, but upgrading now gives you room
              before your audience outgrows the plan.
            </p>
          </>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <Link href="/billing" className={tone.primaryLink}>
            Upgrade plan
          </Link>
          <Link href="/audience" className={tone.secondaryLink}>
            View contacts
          </Link>
        </div>
      </div>
    </div>
  );
}
