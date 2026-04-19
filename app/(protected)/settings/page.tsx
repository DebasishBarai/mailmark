"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import { ConnectAwsAccountWizard } from "../../components/ConnectAwsAccountWizard";

type AwsAccountSummary = {
  _id: Id<"awsAccounts">;
  alias: string;
  region: string;
  s3Bucket: string;
  roleArn: string;
  awsAccountId?: string;
  sesSandbox?: boolean;
  status: "pending" | "verified" | "failed";
  lastError?: string;
  lastVerifiedAt?: number;
  externalId: string;
  _creationTime: number;
};

function StatusPill({ status }: { status: AwsAccountSummary["status"] }) {
  const styles: Record<AwsAccountSummary["status"], string> = {
    verified:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    pending:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  const labels: Record<AwsAccountSummary["status"], string> = {
    verified: "Verified",
    pending: "Pending",
    failed: "Failed",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function formatDate(ms?: number) {
  if (!ms) return "—";
  return new Date(ms).toLocaleString();
}

function AwsAccountCard({
  account,
  linkedDomains,
}: {
  account: AwsAccountSummary;
  linkedDomains: Doc<"domains">[];
}) {
  const removeAccount = useMutation(api.awsAccounts.remove);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const blocked = linkedDomains.length > 0;

  const handleDisconnect = async () => {
    setBusy(true);
    setError("");
    try {
      await removeAccount({ accountId: account._id });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to disconnect");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">
              {account.alias}
            </h3>
            <StatusPill status={account.status} />
            {account.sesSandbox && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                SES sandbox
              </span>
            )}
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-gray-600 dark:text-gray-400 sm:grid-cols-2">
            <div>
              <dt className="inline font-medium">AWS account: </dt>
              <dd className="inline font-mono">{account.awsAccountId ?? "—"}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Region: </dt>
              <dd className="inline font-mono">{account.region}</dd>
            </div>
            <div className="sm:col-span-2 truncate">
              <dt className="inline font-medium">S3 bucket: </dt>
              <dd className="inline font-mono">{account.s3Bucket || "—"}</dd>
            </div>
            <div className="sm:col-span-2 truncate">
              <dt className="inline font-medium">Role ARN: </dt>
              <dd className="inline font-mono">{account.roleArn || "—"}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Last verified: </dt>
              <dd className="inline">{formatDate(account.lastVerifiedAt)}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Connected: </dt>
              <dd className="inline">{formatDate(account._creationTime)}</dd>
            </div>
          </dl>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {!confirming ? (
            <button
              onClick={() => {
                setError("");
                setConfirming(true);
              }}
              disabled={blocked || busy}
              title={
                blocked
                  ? "Delete the linked domains first to disconnect this AWS account."
                  : undefined
              }
              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-900/20"
            >
              Disconnect
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                disabled={busy}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? "Disconnecting..." : "Confirm disconnect"}
              </button>
            </div>
          )}
        </div>
      </div>

      {account.status === "failed" && account.lastError && (
        <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {account.lastError}
        </p>
      )}

      {/* Linked domains */}
      <div
        className={`mt-4 rounded-lg border p-3 text-xs ${
          blocked
            ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
            : "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400"
        }`}
      >
        {blocked ? (
          <>
            <p className="font-medium">
              The following {linkedDomains.length === 1 ? "domain is" : "domains are"} linked to this AWS account:
            </p>
            <ul className="mt-1 list-disc pl-5">
              {linkedDomains.map((d) => (
                <li key={d._id} className="font-mono">
                  {d.domain}
                </li>
              ))}
            </ul>
            <p className="mt-2">
              Delete {linkedDomains.length === 1 ? "this domain" : "these domains"} first to unlink the AWS account.
            </p>
          </>
        ) : (
          <p>No domains are linked to this AWS account.</p>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const awsAccounts = useQuery(api.awsAccounts.listForCurrentUser) as
    | AwsAccountSummary[]
    | undefined;
  const domains = useQuery(api.domains.listForCurrentUser);
  const [showWizard, setShowWizard] = useState(false);

  const domainsByAccount = useMemo(() => {
    const map = new Map<Id<"awsAccounts">, Doc<"domains">[]>();
    if (!domains) return map;
    for (const d of domains) {
      if (!d.awsAccountId) continue;
      const existing = map.get(d.awsAccountId) ?? [];
      existing.push(d);
      map.set(d.awsAccountId, existing);
    }
    return map;
  }, [domains]);

  const isLoading = awsAccounts === undefined || domains === undefined;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage your account and connected infrastructure.
        </p>
      </div>

      <section>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              AWS accounts
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              AWS accounts you&apos;ve connected to host your own email infrastructure.
            </p>
          </div>
          {!showWizard && (
            <button
              onClick={() => setShowWizard(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Connect AWS account
            </button>
          )}
        </div>

        {showWizard && (
          <div className="mb-4">
            <ConnectAwsAccountWizard
              onCancel={() => setShowWizard(false)}
              onVerified={() => setShowWizard(false)}
            />
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
              />
            ))}
          </div>
        ) : (awsAccounts ?? []).length === 0 ? (
          !showWizard && (
            <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-800">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                No connected AWS accounts yet
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Click <strong>Connect AWS account</strong> above to host your email infrastructure in your own AWS account.
              </p>
            </div>
          )
        ) : (
          <div className="space-y-4">
            {(awsAccounts ?? []).map((acc) => (
              <AwsAccountCard
                key={acc._id}
                account={acc}
                linkedDomains={domainsByAccount.get(acc._id) ?? []}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
