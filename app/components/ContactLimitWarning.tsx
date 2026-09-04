"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Amber banner shown when the account holds more contacts than its plan
 * allows. Styled to match the DNS warning banner on the domain detail page so
 * the two read as the same kind of notice.
 *
 * "Contacts" here is the recipients count, the same number the /audience page
 * puts against the plan limit: every distinct address the user has mailed.
 * The contacts table is the reply derived address book and carries no plan
 * limit, so counting it would warn on the wrong number.
 *
 * Nothing enforces the cap yet (see PLAN_LIMITS in convex/quotas.ts), so the
 * copy is careful to say that sending is not blocked and nothing was removed.
 */
export default function ContactLimitWarning() {
  const usage = useQuery(api.quotas.getUsageAndLimits);

  // undefined while the query is in flight, null when signed out.
  if (!usage) return null;

  const limit = usage.limits.recipients;
  const count = usage.usage.recipients;

  // null limit means unlimited on this plan.
  if (limit === null || count <= limit) return null;

  return (
    <div className="mb-8 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
      <svg
        className="mt-0.5 h-5 w-5 shrink-0 text-amber-500"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
        />
      </svg>
      <div>
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
          You have {count.toLocaleString()} contacts, above the{" "}
          {limit.toLocaleString()} included in your {usage.plan} plan.
        </p>
        <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
          Nothing is blocked and no contact has been removed. You can keep sending as
          usual. Upgrading raises the allowance and keeps your account inside its plan.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <Link
            href="/billing"
            className="text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200"
          >
            Upgrade plan
          </Link>
          <Link
            href="/audience"
            className="text-xs font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200"
          >
            View contacts
          </Link>
        </div>
      </div>
    </div>
  );
}
