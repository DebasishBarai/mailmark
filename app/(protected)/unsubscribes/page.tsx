"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export default function UnsubscribesPage() {
  const unsubscribes = useQuery(api.unsubscribe.listForCurrentUser) ?? [];
  const stats = useQuery(api.unsubscribe.getStats);
  const domains = useQuery(api.domains.listForCurrentUser) ?? [];
  const addManual = useMutation(api.unsubscribe.addManual);
  const removeUnsub = useMutation(api.unsubscribe.remove);

  const [addEmail, setAddEmail] = useState("");
  const [addDomainId, setAddDomainId] = useState<Id<"domains"> | "">("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const verifiedDomains = domains.filter((d) => d.verified);

  const filteredUnsubs = searchQuery
    ? unsubscribes.filter(
        (u) =>
          u.email.includes(searchQuery.toLowerCase()) ||
          u.domainName.includes(searchQuery.toLowerCase())
      )
    : unsubscribes;

  const handleAdd = async () => {
    if (!addEmail.trim() || !addDomainId) return;
    setAdding(true);
    setAddError(null);
    try {
      await addManual({ domainId: addDomainId as Id<"domains">, email: addEmail.trim() });
      setAddEmail("");
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: Id<"unsubscribes">) => {
    if (!confirm("Re-subscribe this email? They will start receiving campaign emails again.")) return;
    await removeUnsub({ unsubscribeId: id });
  };

  return (
    <div className="min-h-full bg-gray-50 p-6 dark:bg-gray-900 md:p-10">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Unsubscribe Management</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your unsubscribe list. Campaign emails automatically skip unsubscribed recipients for Gmail/Yahoo compliance.
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 text-center dark:border-gray-700 dark:bg-gray-800">
              <p className="text-3xl font-extrabold text-violet-600">{stats.total}</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Total</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 text-center dark:border-gray-700 dark:bg-gray-800">
              <p className="text-3xl font-extrabold text-amber-600">{stats.last7Days}</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Last 7 days</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 text-center dark:border-gray-700 dark:bg-gray-800">
              <p className="text-3xl font-extrabold text-gray-600 dark:text-gray-300">{stats.last30Days}</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Last 30 days</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 text-center dark:border-gray-700 dark:bg-gray-800">
              <p className="text-3xl font-extrabold text-emerald-600">{stats.bySource["one-click"] ?? 0}</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">One-Click</p>
            </div>
          </div>
        )}

        {/* Add manual unsubscribe */}
        <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add to Unsubscribe List</h2>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div className="min-w-[200px] flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Domain</label>
              <select
                value={addDomainId}
                onChange={(e) => setAddDomainId(e.target.value as Id<"domains">)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              >
                <option value="">Select domain</option>
                {verifiedDomains.map((d) => (
                  <option key={d._id} value={d._id}>{d.domain}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
              <input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="user@example.com"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!addEmail.trim() || !addDomainId || adding}
              className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
            >
              {adding ? "Adding..." : "Add"}
            </button>
          </div>
          {addError && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{addError}</p>
          )}
        </div>

        {/* Unsubscribe list */}
        <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Unsubscribed Emails ({filteredUnsubs.length})
            </h2>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-violet-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          {filteredUnsubs.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51" />
              </svg>
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                {searchQuery ? "No matching unsubscribes found." : "No unsubscribes yet. Recipients who opt out will appear here."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredUnsubs.map((unsub) => (
                <div key={unsub._id} className="flex items-center justify-between px-6 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900 dark:text-white">{unsub.email}</p>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span>{unsub.domainName}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                        unsub.source === "one-click"
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : unsub.source === "link"
                            ? "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                      }`}>
                        {unsub.source === "one-click" ? "One-Click" : unsub.source === "link" ? "Link" : "Manual"}
                      </span>
                      <span>{new Date(unsub.unsubscribedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(unsub._id)}
                    className="ml-4 shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    title="Re-subscribe"
                  >
                    Re-subscribe
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
