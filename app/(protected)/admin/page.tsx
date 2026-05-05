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

  if (stats === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
      </div>
    );
  }

  if (stats === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-lg bg-red-50 p-6 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          Admin access required
        </div>
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

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Platform-wide stats and activity overview
          </p>
        </div>
        <Link
          href="/admin/warmup-accounts"
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          Warmup Accounts
        </Link>
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
      <div className="mb-8">
        <SectionHeader title="Emails" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total Stored" value={stats.emails.total} color="violet" />
          <StatCard label="Sent" value={stats.emails.sent} color="blue" />
          <StatCard label="Received" value={stats.emails.inbox} color="green" />
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
    </div>
  );
}
