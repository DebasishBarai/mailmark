"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
      : score >= 50
        ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
        : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300";

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold ${color}`}>
      {score}/100
    </span>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`}
    />
  );
}

function ReputationBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; dot: string }> = {
    healthy: {
      bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
      dot: "bg-emerald-500",
    },
    warning: {
      bg: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
      dot: "bg-amber-500",
    },
    critical: {
      bg: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
      dot: "bg-red-500",
    },
  };
  const c = config[status] ?? config.warning;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${c.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function DomainHealthPage() {
  const domainData = useQuery(api.domainHealth.latestForCurrentUser) ?? [];

  return (
    <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-900 md:p-10">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Domain Health</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Monitor SPF, DKIM, DMARC records, blacklist status, and sending reputation for all your domains.
          </p>
        </div>

        {/* Domain cards */}
        {domainData.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-800">
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
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
              />
            </svg>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              No domains to monitor yet. Add and verify a domain to start tracking its health.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {domainData.map((item) => (
              <div
                key={item.domainId}
                className="rounded-2xl border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800"
              >
                {/* Domain header */}
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="font-semibold text-gray-900 dark:text-white">
                        {item.domainName}
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {item.verified ? "Verified" : "Unverified"}
                      </p>
                    </div>
                  </div>
                  {item.latestCheck && (
                    <ScoreBadge score={item.latestCheck.overallScore} />
                  )}
                </div>

                {item.latestCheck ? (
                  <div className="px-6 py-5">
                    {/* DNS Records */}
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900">
                        <div className="flex items-center gap-2">
                          <StatusDot ok={item.latestCheck.spfValid} />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">SPF</span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {item.latestCheck.spfValid ? "Valid" : "Missing or invalid"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900">
                        <div className="flex items-center gap-2">
                          <StatusDot ok={item.latestCheck.dkimValid} />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">DKIM</span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {item.latestCheck.dkimValid ? "Valid" : "Missing or invalid"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900">
                        <div className="flex items-center gap-2">
                          <StatusDot ok={item.latestCheck.dmarcValid} />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">DMARC</span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {item.latestCheck.dmarcValid ? "Valid" : "Missing or invalid"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900">
                        <div className="flex items-center gap-2">
                          <StatusDot ok={!item.latestCheck.blacklisted} />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Blacklist</span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {item.latestCheck.blacklisted
                            ? `Listed on ${item.latestCheck.blacklistEntries?.length ?? 0} list(s)`
                            : "Not listed"}
                        </p>
                      </div>
                    </div>

                    {/* Rates & reputation */}
                    <div className="mt-4 flex flex-wrap items-center gap-6 rounded-xl bg-gray-50 px-5 py-4 dark:bg-gray-900">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Bounce Rate</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {item.latestCheck.bounceRate}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Complaint Rate</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {item.latestCheck.complaintRate}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Reputation</p>
                        <div className="mt-1">
                          <ReputationBadge status={item.latestCheck.reputationStatus} />
                        </div>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-xs text-gray-400 dark:text-gray-500">Last checked</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(item.latestCheck.checkedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Blacklist details */}
                    {item.latestCheck.blacklisted && item.latestCheck.blacklistEntries && (
                      <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
                        <p className="text-sm font-medium text-red-700 dark:text-red-300">
                          Blacklist Entries
                        </p>
                        <ul className="mt-2 space-y-1">
                          {item.latestCheck.blacklistEntries.map((entry) => (
                            <li key={entry} className="text-sm text-red-600 dark:text-red-400">
                              {entry}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="px-6 py-8 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Health check pending. Results will appear after the next scheduled check.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
