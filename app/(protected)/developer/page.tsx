"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Doc, Id } from "../../../convex/_generated/dataModel";

const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "https://harmless-armadillo-386.convex.site";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="ml-2 rounded px-2 py-0.5 text-xs font-medium text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-900/20"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100 dark:bg-gray-950">
        <code>{code}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute right-3 top-3 rounded px-2 py-1 text-xs font-medium text-gray-400 hover:bg-gray-700 hover:text-white"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

export default function DeveloperPage() {
  const apiKeys = useQuery(api.apiKeys.listForCurrentUser);
  const domains = useQuery(api.domains.listForCurrentUser);
  const revokeKey = useMutation(api.apiKeys.revoke);
  const createKey = useAction(api.apiKeyActions.create);

  const verifiedDomains = domains?.filter((d) => d.verified) ?? [];

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [selectedDomainId, setSelectedDomainId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createdKey, setCreatedKey] = useState<{ key: string } | null>(null);

  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"curl" | "npm">("curl");

  const handleCreate = async () => {
    if (!newKeyName.trim() || !selectedDomainId) return;
    setIsCreating(true);
    setCreateError("");
    try {
      const result = await createKey({
        name: newKeyName.trim(),
        domainId: selectedDomainId as Id<"domains">,
      });
      setCreatedKey({ key: result.key });
      setShowCreateModal(false);
      setNewKeyName("");
      setSelectedDomainId("");
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (id: Id<"api_keys">) => {
    await revokeKey({ id });
    setRevokeConfirm(null);
  };

  const exampleKey = createdKey?.key ?? "dm_live_your_api_key_here";

  const curlExample = `curl -X POST ${CONVEX_SITE_URL}/v1/send \\
  -H "Authorization: Bearer ${exampleKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "hello@yourdomain.com",
    "to": ["recipient@example.com"],
    "subject": "Hello from RemindMe",
    "html": "<h1>Hello!</h1><p>This was sent via the RemindMe API.</p>"
  }'`;

  const npmExample = `import { RemindMe } from 'remindme';

const client = new RemindMe('${exampleKey}');

await client.send({
  from: 'hello@yourdomain.com',
  to: ['recipient@example.com'],
  subject: 'Hello from RemindMe',
  html: '<h1>Hello!</h1><p>Sent via the RemindMe npm SDK.</p>',
});`;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Developer</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage API keys and integrate RemindMe into your application.
        </p>
      </div>

      {/* Created key banner */}
      {createdKey && (
        <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-700/40 dark:bg-amber-900/20">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Save your API key — it will only be shown once.
              </p>
              <div className="mt-3 flex items-center rounded-lg border border-amber-200 bg-white px-3 py-2 font-mono text-sm dark:border-amber-700/40 dark:bg-gray-900">
                <span className="flex-1 break-all text-gray-800 dark:text-gray-200">
                  {createdKey.key}
                </span>
                <CopyButton value={createdKey.key} />
              </div>
            </div>
            <button
              onClick={() => setCreatedKey(null)}
              className="mt-0.5 text-amber-500 hover:text-amber-700 dark:text-amber-400"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* API Keys */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700/50">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">API Keys</h2>
          <button
            onClick={() => {
              setShowCreateModal(true);
              setCreateError("");
              setSelectedDomainId(verifiedDomains[0]?._id ?? "");
            }}
            disabled={verifiedDomains.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create API Key
          </button>
        </div>

        {verifiedDomains.length === 0 && (
          <div className="px-6 py-5">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              You need at least one verified domain before creating API keys.
            </p>
          </div>
        )}

        {apiKeys === undefined ? (
          <div className="space-y-3 p-6">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
            ))}
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <svg className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
            </svg>
            <p className="mt-3 text-sm font-medium text-gray-900 dark:text-white">No API keys yet</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Create your first key to start sending emails via the API.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {apiKeys.map((key: Doc<"api_keys">) => {
              const domain = domains?.find((d) => d._id === key.domainId);
              return (
                <div key={key._id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{key.name}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-mono">{key.keyPrefix}••••••••</span>
                      {domain && (
                        <span className="rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                          {domain.domain}
                        </span>
                      )}
                      <span>Created {new Date(key.createdAt).toLocaleDateString()}</span>
                      {key.lastUsedAt && (
                        <span>Last used {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  {revokeConfirm === key._id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Revoke this key?</span>
                      <button
                        onClick={() => handleRevoke(key._id)}
                        className="rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        Yes, revoke
                      </button>
                      <button
                        onClick={() => setRevokeConfirm(null)}
                        className="rounded px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRevokeConfirm(key._id)}
                      className="rounded px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Code examples */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-700/50">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Send an Email</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            POST to <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs dark:bg-gray-700">{CONVEX_SITE_URL}/v1/send</code>
          </p>
        </div>

        <div className="p-6">
          {/* Tabs */}
          <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit dark:bg-gray-700">
            {(["curl", "npm"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-white"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {tab === "curl" ? "cURL" : "npm (remindme)"}
              </button>
            ))}
          </div>

          {activeTab === "curl" ? (
            <CodeBlock code={curlExample} />
          ) : (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Install</p>
                <CodeBlock code="npm install remindme" />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Usage</p>
                <CodeBlock code={npmExample} />
              </div>
            </div>
          )}

          {/* Response */}
          <div className="mt-6">
            <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Response</p>
            <CodeBlock code={`{ "messageId": "1234567890-abc12345", "status": "queued" }`} />
          </div>
        </div>
      </div>

      {/* Create API Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl dark:bg-gray-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Create API Key</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              The key will be scoped to a single verified domain.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Key name
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="e.g. Production, My App"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Domain
                </label>
                <select
                  value={selectedDomainId}
                  onChange={(e) => setSelectedDomainId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  {verifiedDomains.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.domain}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  The key will only be able to send from mailboxes on this domain.
                </p>
              </div>

              {createError && (
                <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewKeyName("");
                  setCreateError("");
                }}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newKeyName.trim() || !selectedDomainId || isCreating}
                className="flex-1 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
              >
                {isCreating ? "Creating..." : "Create Key"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
