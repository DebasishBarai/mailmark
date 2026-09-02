"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";

function StatCard({
  label,
  value,
  sub,
  color = "violet",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: "violet" | "green" | "blue" | "amber" | "red";
}) {
  const colors = {
    violet: "text-violet-600 dark:text-violet-400",
    green: "text-green-600 dark:text-green-400",
    blue: "text-blue-600 dark:text-blue-400",
    amber: "text-amber-600 dark:text-amber-400",
    red: "text-red-600 dark:text-red-400",
  };
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${colors[color]}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
      {title}
    </h2>
  );
}

export default function AdminDashboardPage() {
  const stats = useQuery(api.platformStats.getAdminStats);

  if (stats === undefined || stats === null) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
      </div>
    );
  }

  const openRate =
    stats.emails.sent > 0
      ? Math.round((stats.emails.opened / stats.emails.sent) * 100)
      : 0;

  const bounceRate =
    stats.emails.sent > 0
      ? Math.round((stats.emails.bounced / stats.emails.sent) * 100)
      : 0;

  // The five folders the app writes. Shown against the total so a gap is
  // visible rather than silent, which is what the old layout hid.
  const folderSum =
    stats.emails.sent +
    stats.emails.inbox +
    stats.emails.warmup +
    stats.emails.outbox +
    stats.emails.trash;

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Platform-wide stats and activity overview
        </p>
      </div>

      {/* Users */}
      <div className="mb-8">
        <SectionHeader title="Users" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Users" value={stats.users.total} color="violet" />
          <StatCard label="Normal" value={stats.users.normal} color="blue" />
          <StatCard label="Beta" value={stats.users.beta} color="green" />
          <StatCard label="Admin" value={stats.users.admin} color="amber" />
        </div>
      </div>

      {/* Emails */}
      {/*
        Old: Total Stored sat beside Sent and Received as though it were their
        sum. It never was. Total counts every row in the emails table, while
        those two count the sent and inbox folders only, leaving everything in
        outbox, trash and _warmup in the total and named nowhere on the page.
        Warmup alone is the largest folder on a platform running warmup.

        The three missing folders now have cards of their own, so the row
        accounts for the whole table. Delivery stats are unchanged and moved to
        their own row, since they measure outcomes rather than storage.
      */}
      <div className="mb-8">
        <SectionHeader title="Emails" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total Stored" value={stats.emails.total} color="violet" sub="all folders" />
          <StatCard label="Sent" value={stats.emails.sent} color="blue" />
          <StatCard label="Received" value={stats.emails.inbox} color="green" sub="inbox" />
          <StatCard label="Warmup" value={stats.emails.warmup} color="amber" sub="pool mail, kept out of the inbox" />
          <StatCard label="Outbox" value={stats.emails.outbox} color="violet" sub="scheduled, not yet sent" />
          <StatCard label="Trash" value={stats.emails.trash} color="amber" sub="deleted, still stored" />
        </div>
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          Sent + Received + Warmup + Outbox + Trash ={" "}
          {folderSum.toLocaleString()} of {stats.emails.total.toLocaleString()}{" "}
          stored.
          {folderSum !== stats.emails.total && (
            <>
              {" "}
              The {Math.abs(stats.emails.total - folderSum).toLocaleString()} not
              accounted for are folder counters the nightly reconcile has yet to
              fill in.
            </>
          )}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label="Delivered" value={stats.emails.delivered} color="green" sub={`${stats.emails.sent > 0 ? Math.round((stats.emails.delivered / stats.emails.sent) * 100) : 0}% of sent`} />
          <StatCard label="Opened" value={stats.emails.opened} color="blue" sub={`${openRate}% open rate`} />
          <StatCard label="Bounced" value={stats.emails.bounced} color={bounceRate > 5 ? "red" : "amber"} sub={`${bounceRate}% bounce rate`} />
        </div>
      </div>

      {/* Domains & Mailboxes */}
      <div className="mb-8">
        <SectionHeader title="Domains & Mailboxes" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Domains" value={stats.domains.total} color="violet" />
          <StatCard label="Verified" value={stats.domains.verified} color="green" />
          <StatCard label="Unverified" value={stats.domains.unverified} color="amber" />
          <StatCard label="Mailboxes" value={stats.mailboxes.total} color="blue" />
        </div>
      </div>

      {/* Subscriptions */}
      <div className="mb-8">
        <SectionHeader title="Subscriptions" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Active Subs" value={stats.subscriptions.total} color="green" />
          <StatCard label="Starter" value={stats.subscriptions.byPlan.starter} color="blue" />
          <StatCard label="Pro" value={stats.subscriptions.byPlan.pro} color="violet" />
          <StatCard label="Business" value={stats.subscriptions.byPlan.business} color="amber" />
        </div>
      </div>

      {/* Warmup */}
      <div className="mb-8">
        <SectionHeader title="Email Warmup" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="Active Mailboxes"
            value={stats.warmup.activeMailboxes}
            sub={`of ${stats.warmup.totalMailboxes} total`}
            color="violet"
          />
          <StatCard label="Warmup Emails Sent" value={stats.warmup.emailsSent} color="blue" />
          <StatCard
            label="Inbox Placement"
            value={`${stats.warmup.inboxPlacement}%`}
            color={stats.warmup.inboxPlacement >= 80 ? "green" : stats.warmup.inboxPlacement >= 60 ? "amber" : "red"}
          />
          <StatCard
            label="Platform Accounts"
            value={stats.warmup.platformAccounts}
            sub={`${stats.warmup.totalPlatformAccounts} total`}
            color="blue"
          />
          <StatCard
            label="Daily Capacity"
            value={`~${(stats.warmup.platformAccounts * 450).toLocaleString()}`}
            color="green"
          />
        </div>
      </div>

      {/* Sequences, Contacts, API Keys */}
      <div className="mb-8">
        <SectionHeader title="Other" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Sequences" value={stats.sequences.total} sub={`${stats.sequences.active} active`} color="violet" />
          <StatCard label="Contacts" value={stats.contacts.total} color="blue" />
          <StatCard label="API Keys" value={stats.apiKeys.active} sub={`${stats.apiKeys.total} total`} color="green" />
        </div>
      </div>

      {/* Recent Signups */}
      <div>
        <SectionHeader title="Recent Signups (last 7 days)" />
        {stats.users.recentSignups.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No new signups in the last 7 days.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Category</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Joined</th>
                </tr>
              </thead>
              <tbody>
                {stats.users.recentSignups.map((user, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0 dark:border-gray-700/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{user.email}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{user.name ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.category === "admin"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : user.category === "beta"
                            ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                        }`}
                      >
                        {user.category ?? "normal"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">
                      {new Date(user.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin Tools */}
      <div className="mt-10">
        <SectionHeader title="Admin Tools" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/admin/warmup-accounts"
            className="group flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-violet-300 hover:bg-violet-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-violet-700 dark:hover:bg-violet-900/20"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 group-hover:text-violet-700 dark:text-white dark:group-hover:text-violet-300">
                Warmup Accounts
              </p>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                Manage platform Gmail accounts used for email warmup across all users.
              </p>
              <p className="mt-2 text-xs font-medium text-violet-600 dark:text-violet-400">
                {stats.warmup.platformAccounts} active / {stats.warmup.totalPlatformAccounts} total
              </p>
            </div>
          </Link>

          <Link
            href="/admin/domains"
            className="group flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-violet-300 hover:bg-violet-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-violet-700 dark:hover:bg-violet-900/20"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 group-hover:text-violet-700 dark:text-white dark:group-hover:text-violet-300">
                Domains
              </p>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                Inspect raw SES verification status and re-run checks for any domain on the platform.
              </p>
              <p className="mt-2 text-xs font-medium text-violet-600 dark:text-violet-400">
                {stats.domains.verified} verified / {stats.domains.total} total
              </p>
            </div>
          </Link>

          <Link
            href="/admin/email-activity"
            className="group flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-violet-300 hover:bg-violet-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-violet-700 dark:hover:bg-violet-900/20"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 group-hover:text-violet-700 dark:text-white dark:group-hover:text-violet-300">
                Email Activity
              </p>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                Per-domain sent and scheduled mail with recipients, timings, and repeat contact counts.
              </p>
              <p className="mt-2 text-xs font-medium text-violet-600 dark:text-violet-400">
                {stats.emails.sent.toLocaleString()} sent / {stats.emails.outbox.toLocaleString()} scheduled
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
