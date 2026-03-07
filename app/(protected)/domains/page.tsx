"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Doc } from "../../../convex/_generated/dataModel";

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ok
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
        }`}
    >
      {ok ? (
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {label}
    </span>
  );
}

export default function DomainsPage() {
  const domains = useQuery(api.domains.listForCurrentUser);
  const addDomain = useAction(api.domainActions.add);
  const isLoading = domains === undefined;

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

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Domains</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your email domains and DNS verification.
          </p>
        </div>
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

      {/* Domain list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800" />
          ))}
        </div>
      ) : domains.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-800">
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
            Add your first domain to get started with DevMail.
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
        <div className="space-y-4">
          {domains.map((d: Doc<"domains">) => (
            <Link
              key={d._id}
              href={`/domains/${d._id}`}
              className="block rounded-xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{d.domain}</h3>
                    {d.verified ? (
                      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Verified
                      </span>
                    ) : (
                      <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
                <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge ok={d.mxVerified} label="MX" />
                <StatusBadge ok={d.spfVerified} label="SPF" />
                <StatusBadge ok={d.dkimVerified} label="DKIM" />
                <StatusBadge ok={d.dmarcVerified} label="DMARC" />
              </div>
            </Link>
          ))}
        </div>
      )}

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
