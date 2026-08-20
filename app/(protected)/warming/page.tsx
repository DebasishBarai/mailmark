"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// const RAMP_SCHEDULE = [
//   { days: "1-3", limit: 5 },
//   { days: "4-7", limit: 15 },
//   { days: "8-14", limit: 40 },
//   { days: "15-21", limit: 100 },
//   { days: "22-28", limit: 250 },
// ];

function HealthBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      : score >= 50
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {score}%
    </span>
  );
}

function SpeedLabel({ speed }: { speed: string }) {
  const styles: Record<string, string> = {
    slow: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    normal: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    fast: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[speed] ?? styles.normal}`}>
      {speed}
    </span>
  );
}

export default function WarmingPage() {
  const warmupMailboxes = useQuery(api.warmupPool.listForCurrentUser) ?? [];
  const domains = useQuery(api.domains.listForCurrentUser) ?? [];
  const startWarmup = useMutation(api.warmupPool.startWarmup);
  const pauseWarmup = useMutation(api.warmupPool.pauseWarmup);
  const resumeWarmup = useMutation(api.warmupPool.resumeWarmup);
  const updateSpeed = useMutation(api.warmupPool.updateSpeed);

  // Legacy warming schedules (kept for backward compat)
  // const legacySchedules = useQuery(api.warmingSchedules.listForCurrentUser) ?? [];

  const [selectedMailbox, setSelectedMailbox] = useState<Id<"mailboxes"> | "">("");
  const [selectedSpeed, setSelectedSpeed] = useState<"slow" | "normal" | "fast">("normal");
  const [selectedDomain, setSelectedDomain] = useState<Id<"domains"> | "">("");
  const [starting, setStarting] = useState(false);
  const [expandedId, setExpandedId] = useState<Id<"warmupMailboxes"> | null>(null);

  const verifiedDomains = domains.filter((d) => d.verified && d.spfVerified && d.dkimVerified && d.dmarcVerified);

  const mailboxes = useQuery(
    api.mailboxes.listByDomain,
    selectedDomain ? { domainId: selectedDomain as Id<"domains"> } : "skip"
  ) ?? [];

  const expandedHistory = useQuery(
    api.warmupPool.getRecentWarmupEmails,
    expandedId ? { warmupMailboxId: expandedId, limit: 20 } : "skip"
  );

  const handleStart = async () => {
    if (!selectedMailbox) return;
    setStarting(true);
    try {
      await startWarmup({
        mailboxId: selectedMailbox as Id<"mailboxes">,
        speed: selectedSpeed,
      });
      setSelectedMailbox("");
      setSelectedDomain("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start warmup");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-full bg-gray-50 p-6 dark:bg-gray-900 md:p-10">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Warmup</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Real email exchange with Gmail accounts to build domain reputation. Warmup emails are
            sent, opened, replied to, and rescued from spam automatically.
          </p>
        </div>

        {/* Speed reference */}
        <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Warmup Speed Profiles
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-900/20">
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">Slow</p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                2/day to 20/day over 4+ weeks. Safest for brand-new domains.
              </p>
            </div>
            <div className="rounded-xl bg-violet-50 p-4 dark:bg-violet-900/20">
              <p className="text-sm font-semibold text-violet-700 dark:text-violet-400">Normal</p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                5/day to 20/day over 2-3 weeks. Good balance for most domains.
              </p>
            </div>
            <div className="rounded-xl bg-orange-50 p-4 dark:bg-orange-900/20">
              <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">Fast</p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                10/day to 20/day over 1-2 weeks. For domains with some existing reputation.
              </p>
            </div>
          </div>
        </div>

        {/* Start new warmup */}
        <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Add Mailbox to Warmup
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Domain must have SPF, DKIM, and DMARC fully configured.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div className="min-w-[180px] flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Domain
              </label>
              <select
                value={selectedDomain}
                onChange={(e) => {
                  setSelectedDomain(e.target.value as Id<"domains">);
                  setSelectedMailbox("");
                }}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              >
                <option value="">Select a domain</option>
                {verifiedDomains.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.domain}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[180px] flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Mailbox
              </label>
              <select
                value={selectedMailbox}
                onChange={(e) => setSelectedMailbox(e.target.value as Id<"mailboxes">)}
                disabled={!selectedDomain}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              >
                <option value="">Select a mailbox</option>
                {mailboxes.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.fullAddress}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[140px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Speed
              </label>
              <select
                value={selectedSpeed}
                onChange={(e) => setSelectedSpeed(e.target.value as "slow" | "normal" | "fast")}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              >
                <option value="slow">Slow</option>
                <option value="normal">Normal</option>
                <option value="fast">Fast</option>
              </select>
            </div>
            <button
              onClick={handleStart}
              disabled={!selectedMailbox || starting}
              className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
            >
              {starting ? "Starting..." : "Start Warmup"}
            </button>
          </div>
        </div>

        {/* Enrolled mailboxes */}
        <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Your Mailboxes in Warmup
            </h2>
          </div>

          {warmupMailboxes.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"
                />
              </svg>
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                No mailboxes in warmup yet. Add one above to start building domain reputation.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {warmupMailboxes.map((wmb) => (
                <div key={wmb._id} className="px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {wmb.mailboxAddress}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {wmb.domainName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <HealthBadge score={wmb.healthScore} />
                      <SpeedLabel speed={wmb.speed} />
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                          wmb.status === "active"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            wmb.status === "active" ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                        />
                        {wmb.status.charAt(0).toUpperCase() + wmb.status.slice(1)}
                      </span>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Day</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {wmb.currentDay}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Inbox Rate</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {wmb.inboxRate}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Sent Today</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {wmb.sentToday} / {wmb.dailyLimit}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Received Today</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {wmb.receivedToday} / {wmb.dailyLimit}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Daily Limit</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {wmb.dailyLimit}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {wmb.status === "active" ? (
                      <button
                        onClick={() => pauseWarmup({ warmupMailboxId: wmb._id })}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        Pause
                      </button>
                    ) : (
                      <button
                        onClick={() => resumeWarmup({ warmupMailboxId: wmb._id })}
                        className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
                      >
                        Resume
                      </button>
                    )}

                    <select
                      value={wmb.speed}
                      onChange={(e) =>
                        updateSpeed({
                          warmupMailboxId: wmb._id,
                          speed: e.target.value as "slow" | "normal" | "fast",
                        })
                      }
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                    >
                      <option value="slow">Slow</option>
                      <option value="normal">Normal</option>
                      <option value="fast">Fast</option>
                    </select>

                    <button
                      onClick={() => setExpandedId(expandedId === wmb._id ? null : wmb._id)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      {expandedId === wmb._id ? "Hide Activity" : "View Activity"}
                    </button>
                  </div>

                  {/* Expanded activity table */}
                  {expandedId === wmb._id && (
                    <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Direction</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">From</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">To</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Subject</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Sent</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Placement</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Opened</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Replied</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(expandedHistory ?? []).map((email) => (
                            <tr key={email._id} className="border-b border-gray-100 dark:border-gray-700/50">
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                    email.direction === "outbound"
                                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                      : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  }`}
                                >
                                  {email.direction}
                                </span>
                              </td>
                              <td className="max-w-[120px] truncate px-3 py-2 text-gray-600 dark:text-gray-400">
                                {email.fromAddress}
                              </td>
                              <td className="max-w-[120px] truncate px-3 py-2 text-gray-600 dark:text-gray-400">
                                {email.toAddress}
                              </td>
                              <td className="max-w-[180px] truncate px-3 py-2 text-gray-900 dark:text-white">
                                {email.subject}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-gray-500 dark:text-gray-400">
                                {new Date(email.sentAt).toLocaleString()}
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                    email.placement === "inbox"
                                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                      : email.placement === "spam"
                                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                        : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                                  }`}
                                >
                                  {email.placement}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-500 dark:text-gray-400">
                                {email.openedAt ? "Yes" : "--"}
                              </td>
                              <td className="px-3 py-2 text-gray-500 dark:text-gray-400">
                                {email.repliedAt ? "Yes" : "--"}
                              </td>
                            </tr>
                          ))}
                          {(expandedHistory ?? []).length === 0 && (
                            <tr>
                              <td colSpan={8} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                                No warmup emails yet. Activity will appear after the next warmup round.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
