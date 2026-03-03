"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Doc } from "../../../convex/_generated/dataModel";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";

export default function DashboardPage() {
  const domains = useQuery(api.domains.listForCurrentUser);
  const emailStats = useQuery(api.emailStats.getForCurrentUser);
  const addDomain = useAction(api.domainActions.add);
  const isLoading = domains === undefined;
  const statsLoading = emailStats === undefined;

  const domainCount = domains?.length ?? 0;

  const [showAddModal, setShowAddModal] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

  const handleAddDomain = async () => {
    const domain = newDomain.trim().toLowerCase();
    if (!domain) return;
    if (!domainRegex.test(domain)) {
      setAddError("Please enter a valid domain (e.g. example.com).");
      return;
    }
    setIsAdding(true);
    setAddError("");
    try {
      await addDomain({ domain: newDomain.trim().toLowerCase() });
      setShowAddModal(false);
      setNewDomain("");
    } catch (error: any) {
      const message = error?.message ?? "Failed to add domain";
      if (message.includes("Domain already exists")) {
        setAddError("This domain has already been added. Please use a different domain.");
      } else {
        setAddError(message);
      }
    } finally {
      setIsAdding(false);
    }
  };

  const deliveryData = emailStats
    ? [
        { name: "Delivered", value: emailStats.delivered, color: "#22C55E" },
        { name: "Opened", value: emailStats.opened, color: "#16A34A" },
        { name: "Pending", value: emailStats.pending, color: "#6B7280" },
        { name: "Failed", value: emailStats.failed, color: "#EF4444" },
        { name: "Bounced", value: emailStats.bounced, color: "#F59E0B" },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Welcome back. Here&apos;s an overview of your email platform.
        </p>
      </div>

      {/* Stats grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/domains"
          className="rounded-xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
        >
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Domains</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {isLoading ? (
              <span className="inline-block h-8 w-8 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            ) : (
              domainCount
            )}
          </p>
          <span className="mt-2 inline-block rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
            View all
          </span>
        </Link>

        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Sent</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {statsLoading ? (
              <span className="inline-block h-8 w-8 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            ) : (
              emailStats?.totalSent ?? 0
            )}
          </p>
          <span className="mt-2 inline-block rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
            All time
          </span>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Delivery Rate</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {statsLoading ? (
              <span className="inline-block h-8 w-8 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            ) : (
              <>{emailStats?.deliveryRate ?? 0}%</>
            )}
          </p>
          {!statsLoading && emailStats && (
            <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              emailStats.deliveryRate >= 90
                ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : emailStats.deliveryRate >= 70
                  ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                  : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            }`}>
              {emailStats.deliveryRate >= 90 ? "Good" : emailStats.deliveryRate >= 70 ? "Fair" : "Low"}
            </span>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Open Rate</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {statsLoading ? (
              <span className="inline-block h-8 w-8 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            ) : (
              <>{emailStats?.openRate ?? 0}%</>
            )}
          </p>
          {!statsLoading && emailStats && (
            <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              emailStats.openRate >= 30
                ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : emailStats.openRate >= 15
                  ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                  : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            }`}>
              {emailStats.openRate >= 30 ? "Good" : emailStats.openRate >= 15 ? "Fair" : "Low"}
            </span>
          )}
        </div>
      </div>

      {/* Charts */}
      {emailStats && emailStats.totalSent + emailStats.totalInbox > 0 && (
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          {/* Daily Volume Bar Chart */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
              Email Volume (Last 30 Days)
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={emailStats.dailyVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  interval="preserveStartEnd"
                  tickLine={false}
                  axisLine={{ stroke: "#E5E7EB" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={{ stroke: "#E5E7EB" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1F2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#F9FAFB",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="sent" name="Sent" fill="#7C3AED" radius={[3, 3, 0, 0]} />
                <Bar dataKey="received" name="Received" fill="#06B6D4" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Delivery Status Pie Chart */}
          {emailStats.totalSent > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
                Delivery Status
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={deliveryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }: { name: string; percent?: number }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={{ stroke: "#9CA3AF" }}
                  >
                    {deliveryData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1F2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#F9FAFB",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Quick actions */}
      <div className="mb-8 flex flex-wrap gap-3">
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Domain
        </button>
      </div>

      {/* Domains list */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700/50">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Your Domains</h2>
          <Link href="/domains" className="text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300">
            Manage
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
            ))}
          </div>
        ) : domainCount === 0 ? (
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
                d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
              />
            </svg>
            <p className="mt-4 text-sm font-medium text-gray-900 dark:text-white">No domains yet</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Add your first domain to start creating mailboxes and sending campaigns.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Your First Domain
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {domains.map((domain: Doc<"domains">) => (
              <Link
                key={domain._id}
                href={`/domains/${domain._id}`}
                className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{domain.domain}</p>
                  <div className="mt-1 flex gap-2">
                    {domain.verified ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Verified
                      </span>
                    ) : (
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
                <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Add domain modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl dark:bg-gray-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add a Domain</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Enter the domain you own and want to use for email.
            </p>
            <div className="mt-6">
              <label htmlFor="domain" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Domain name
              </label>
              <input
                id="domain"
                type="text"
                value={newDomain}
                onChange={(e) => { setNewDomain(e.target.value); setAddError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleAddDomain()}
                placeholder="yourcompany.com"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
              />
              {addError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{addError}</p>
              )}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewDomain("");
                  setAddError("");
                }}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDomain}
                disabled={!newDomain.trim() || isAdding}
                className="flex-1 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
              >
                {isAdding ? "Adding..." : "Add Domain"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
