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
  const updateTokens = useMutation(api.platformWarmupAccounts.updateTokens);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newAccessToken, setNewAccessToken] = useState("");
  const [newRefreshToken, setNewRefreshToken] = useState("");
  const [newTokenExpiry, setNewTokenExpiry] = useState("");
  const [error, setError] = useState("");

  const [reconnectId, setReconnectId] = useState<Id<"platformWarmupAccounts"> | null>(null);
  const [reconnectAccessToken, setReconnectAccessToken] = useState("");
  const [reconnectRefreshToken, setReconnectRefreshToken] = useState("");
  const [reconnectTokenExpiry, setReconnectTokenExpiry] = useState("");

  if (accounts === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
      </div>
    );
  }

  if (accounts === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-lg bg-red-50 p-6 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          Admin access required
        </div>
      </div>
    );
  }

  const activeCount = accounts.filter((a) => a.status === "active").length;
  const totalCapacity = activeCount * 450;

  async function handleAdd() {
    setError("");
    try {
      await addAccount({
        email: newEmail,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        tokenExpiresAt: newTokenExpiry ? new Date(newTokenExpiry).getTime() : Date.now() + 3600000,
      });
      setShowAddForm(false);
      setNewEmail("");
      setNewAccessToken("");
      setNewRefreshToken("");
      setNewTokenExpiry("");
    } catch (err: any) {
      setError(err.message || "Failed to add account");
    }
  }

  async function handleReconnect() {
    if (!reconnectId) return;
    setError("");
    try {
      await updateTokens({
        accountId: reconnectId,
        accessToken: reconnectAccessToken,
        refreshToken: reconnectRefreshToken,
        tokenExpiresAt: reconnectTokenExpiry ? new Date(reconnectTokenExpiry).getTime() : Date.now() + 3600000,
      });
      setReconnectId(null);
      setReconnectAccessToken("");
      setReconnectRefreshToken("");
      setReconnectTokenExpiry("");
    } catch (err: any) {
      setError(err.message || "Failed to reconnect");
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
                        : account.status === "paused"
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {account.status}
                  </span>
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
                    {account.status === "token_expired" && (
                      <button
                        onClick={() => setReconnectId(account._id)}
                        className="rounded px-2 py-1 text-xs font-medium text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-900/20"
                      >
                        Reconnect
                      </button>
                    )}
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
            Connect Gmail Account
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
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Access Token</label>
                <input
                  type="password"
                  value={newAccessToken}
                  onChange={(e) => setNewAccessToken(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Refresh Token</label>
                <input
                  type="password"
                  value={newRefreshToken}
                  onChange={(e) => setNewRefreshToken(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  Token Expiry (optional)
                </label>
                <input
                  type="datetime-local"
                  value={newTokenExpiry}
                  onChange={(e) => setNewTokenExpiry(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={!newEmail || !newAccessToken || !newRefreshToken}
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

      {/* Reconnect Modal */}
      {reconnectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Reconnect Account
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Access Token</label>
                <input
                  type="password"
                  value={reconnectAccessToken}
                  onChange={(e) => setReconnectAccessToken(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Refresh Token</label>
                <input
                  type="password"
                  value={reconnectRefreshToken}
                  onChange={(e) => setReconnectRefreshToken(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  Token Expiry (optional)
                </label>
                <input
                  type="datetime-local"
                  value={reconnectTokenExpiry}
                  onChange={(e) => setReconnectTokenExpiry(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleReconnect}
                  disabled={!reconnectAccessToken || !reconnectRefreshToken}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  Reconnect
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
