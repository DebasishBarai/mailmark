"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import DashboardView from "../../../../components/DashboardView";

/**
 * One user's dashboard, as that user sees it, for an admin.
 *
 * It renders the same DashboardView component /dashboard renders, over the
 * same data shape, so what an admin reads here is what the user reads. The
 * only differences are the banner above it and readOnly, which drops the
 * controls that would act on the admin's own account rather than this one.
 *
 * This is not impersonation. No session is assumed, no cookie is swapped and
 * nothing here can write. The three queries behind it are admin-gated in
 * Convex, so the data is fetched as the admin and scoped to the named user
 * server side rather than trusted from the URL.
 */
export default function AdminUserDashboardPage() {
  const { userId: rawUserId } = useParams<{ userId: string }>();
  const userId = rawUserId as Id<"users">;

  const user = useQuery(api.users.getForAdmin, { userId });
  const domains = useQuery(api.domains.listForUserAsAdmin, { userId });
  const emailStats = useQuery(api.emailStats.getForUserAsAdmin, { userId });
  const usage = useQuery(api.quotas.getUsageAndLimitsForUserAsAdmin, { userId });

  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
      </div>
    );
  }

  // null means the id names no user, or the caller is not an admin. The admin
  // layout already redirects a non-admin away, so in practice this is a stale
  // or mistyped id.
  if (user === null) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Link
          href="/admin/users"
          className="text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
        >
          &larr; Users
        </Link>
        <p className="mt-6 rounded-lg border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          No user with that id. They may have been deleted.
        </p>
      </div>
    );
  }

  const banner = (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
      <div className="flex items-start gap-3">
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
            d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Viewing {user.name ? `${user.name} (${user.email})` : user.email} as they see it.
          </p>
          <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
            Read only. Nothing on this page can change their account, and they are not
            notified. Actions and links that would apply to your own account are hidden.
          </p>
        </div>
      </div>
      <Link
        href="/admin/users"
        className="shrink-0 text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200"
      >
        Back to users
      </Link>
    </div>
  );

  return (
    <DashboardView
      domains={domains}
      emailStats={emailStats}
      usage={usage}
      readOnly
      banner={banner}
    />
  );
}
