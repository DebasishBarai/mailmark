"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export default function AdminWarmupAccountsPage() {
  const accounts = useQuery(api.platformWarmupAccounts.listAllAccounts);
  const addAccount = useMutation(api.platformWarmupAccounts.addAccount);
  const pauseAccount = useMutation(api.platformWarmupAccounts.pauseAccount);
  const activateAccount = useMutation(api.platformWarmupAccounts.activateAccount);
  const removeAccount = useMutation(api.platformWarmupAccounts.removeAccount);
  const updateAppPassword = useMutation(api.platformWarmupAccounts.updateAppPassword);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newAppPassword, setNewAppPassword] = useState("");
  const [error, setError] = useState("");

  const [reconnectId, setReconnectId] = useState<Id<"platformWarmupAccounts"> | null>(null);
  const [reconnectAppPassword, setReconnectAppPassword] = useState("");

  if (accounts === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
      </div>
    );
  }

  if (accounts === null) {
    return null;
  }

  const activeCount = accounts.filter((a) => a.status === "active").length;
  const totalCapacity = activeCount * 450;

  async function handleAdd() {
    setError("");
    try {
      await addAccount({
        email: newEmail,
        appPassword: newAppPassword.replace(/\s/g, ""),
      });
      setShowAddForm(false);
      setNewEmail("");
      setNewAppPassword("");
    } catch (err: any) {
      setError(err.message || "Failed to add account");
    }
  }

  async function handleUpdatePassword() {
    if (!reconnectId) return;
    setError("");
    try {
      await updateAppPassword({
        accountId: reconnectId,
        appPassword: reconnectAppPassword.replace(/\s/g, ""),
      });
      setReconnectId(null);
      setReconnectAppPassword("");
    } catch (err: any) {
      setError(err.message || "Failed to update app password");
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Platform Warmup Accounts
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage Gmail accounts used for warmup email exchange across all users.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Active Accounts</p>
          <p className="text-2xl font-bold text-violet-600">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Daily Outbound Capacity</p>
          <p className="text-2xl font-bold text-violet-600">~{totalCapacity.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Accounts</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{accounts.length}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Setup Instructions */}
      <div className="mb-6 rounded-lg border border-violet-200 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-900/20">
        <h3 className="mb-2 text-sm font-semibold text-violet-800 dark:text-violet-300">
          How to get a Gmail App Password
        </h3>
        <ol className="list-inside list-decimal space-y-1 text-sm text-violet-700 dark:text-violet-400">
          <li>Sign into the Gmail account</li>
          <li>Go to Google Account &gt; Security &gt; enable 2-Step Verification</li>
          <li>Search &quot;App Passwords&quot; in account settings</li>
          <li>Create a new app password (select &quot;Mail&quot; as the app)</li>
          <li>Copy the 16-character password and paste it below</li>
        </ol>
      </div>

      {/* Account Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Email</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Sent Today</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Received Today</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account._id} className="border-b border-gray-100 dark:border-gray-700/50">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                  {account.email}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      account.status === "active"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : account.autoPausedAt
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                    }`}
                  >
                    {account.autoPausedAt ? "auto-paused" : account.status}
                  </span>
                  {/* Why the engine pulled this account out of rotation, so a
                      dead app password is visible instead of buried in logs. */}
                  {account.lastFailureReason && (
                    <p
                      className="mt-1 max-w-xs truncate text-xs text-gray-500 dark:text-gray-400"
                      title={account.lastFailureReason}
                    >
                      {account.lastFailureReason}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                  {account.dailySentCount}
                </td>
                <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                  {account.dailyReceivedCount}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {account.status === "active" && (
                      <button
                        onClick={() => pauseAccount({ accountId: account._id })}
                        className="rounded px-2 py-1 text-xs font-medium text-yellow-600 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-900/20"
                      >
                        Pause
                      </button>
                    )}
                    {account.status === "paused" && (
                      <button
                        onClick={() => activateAccount({ accountId: account._id })}
                        className="rounded px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                      >
                        Activate
                      </button>
                    )}
                    <button
                      onClick={() => setReconnectId(account._id)}
                      className="rounded px-2 py-1 text-xs font-medium text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-900/20"
                    >
                      Update Password
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${account.email}?`)) {
                          removeAccount({ accountId: account._id });
                        }
                      }}
                      className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No platform warmup accounts configured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Account Button / Form */}
      <div className="mt-6">
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Gmail Account
          </button>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
              Add Platform Gmail Account
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="warmup1@gmail.com"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">App Password</label>
                <input
                  type="password"
                  value={newAppPassword}
                  onChange={(e) => setNewAppPassword(e.target.value)}
                  placeholder="xxxx xxxx xxxx xxxx"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  16-character password from Google Account &gt; Security &gt; App Passwords
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={!newEmail || !newAppPassword}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  Add Account
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Update Password Modal */}
      {reconnectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Update App Password
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">New App Password</label>
                <input
                  type="password"
                  value={reconnectAppPassword}
                  onChange={(e) => setReconnectAppPassword(e.target.value)}
                  placeholder="xxxx xxxx xxxx xxxx"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  Generate a new app password from Google Account settings
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleUpdatePassword}
                  disabled={!reconnectAppPassword}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  Update
                </button>
                <button
                  onClick={() => setReconnectId(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
