"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { ConnectAwsAccountWizard } from "./ConnectAwsAccountWizard";

type InfraChoice = "platform" | "byo";

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

type Props = {
  onClose: () => void;
  onAdded?: () => void;
};

const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export function AddDomainModal({ onClose, onAdded }: Props) {
  const awsAccounts = useQuery(api.awsAccounts.listForCurrentUser) as
    | AwsAccountSummary[]
    | undefined;
  const addDomain = useAction(api.domainActions.add);

  const verifiedAccounts = useMemo(
    () => (awsAccounts ?? []).filter((a) => a.status === "verified"),
    [awsAccounts]
  );

  const [newDomain, setNewDomain] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [infra, setInfra] = useState<InfraChoice>("platform");
  const [selectedAccountId, setSelectedAccountId] =
    useState<Id<"awsAccounts"> | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    if (infra === "byo" && verifiedAccounts.length === 0) {
      setShowWizard(true);
    }
  }, [infra, verifiedAccounts.length]);

  const handleAddDomain = async () => {
    const domain = newDomain.trim().toLowerCase();
    if (!domain) return;
    if (!DOMAIN_REGEX.test(domain)) {
      setAddError("Please enter a valid domain (e.g. example.com).");
      return;
    }
    let awsAccountId: Id<"awsAccounts"> | undefined = undefined;
    if (infra === "byo") {
      if (!selectedAccountId) {
        setAddError(
          "Please select an AWS account or connect a new one before adding a domain."
        );
        return;
      }
      awsAccountId = selectedAccountId;
    }
    setIsAdding(true);
    setAddError("");
    try {
      await addDomain({ domain, awsAccountId });
      onAdded?.();
      onClose();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to add domain";
      if (message.includes("Domain already exists")) {
        setAddError(
          "This domain has already been added. Please use a different domain."
        );
      } else {
        setAddError(message);
      }
    } finally {
      setIsAdding(false);
    }
  };

  const canSubmitAddDomain =
    !!newDomain.trim() &&
    !isAdding &&
    (infra === "platform" || !!selectedAccountId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-8 shadow-2xl dark:bg-gray-800">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add a Domain</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Enter the domain you own and choose where its email infrastructure should live.
        </p>

        {/* Domain name */}
        <div className="mt-6">
          <label htmlFor="domain" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Domain name
          </label>
          <input
            id="domain"
            type="text"
            value={newDomain}
            onChange={(e) => { setNewDomain(e.target.value); setAddError(""); }}
            placeholder="yourcompany.com"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
          />
        </div>

        {/* Infrastructure picker */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Infrastructure
          </label>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Where the SES identity, S3 bucket, Lambda and SNS topics will live.
          </p>

          <div className="mt-3 space-y-2">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                infra === "platform"
                  ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                  : "border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500"
              }`}
            >
              <input
                type="radio"
                name="infra"
                checked={infra === "platform"}
                onChange={() => {
                  setInfra("platform");
                  setSelectedAccountId(null);
                  setShowWizard(false);
                }}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Mailmark infrastructure
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  We host and manage the AWS resources. Simplest setup. Recommended.
                </div>
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                infra === "byo"
                  ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                  : "border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500"
              }`}
            >
              <input
                type="radio"
                name="infra"
                checked={infra === "byo"}
                onChange={() => setInfra("byo")}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Use my own AWS account
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Provision the same infrastructure inside your AWS account via CloudFormation. You keep full ownership of the data.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* BYO picker */}
        {infra === "byo" && (
          <div className="mt-6 space-y-3">
            {verifiedAccounts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Your connected AWS accounts
                </p>
                {verifiedAccounts.map((acc) => (
                  <label
                    key={acc._id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      selectedAccountId === acc._id
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                        : "border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500"
                    }`}
                  >
                    <input
                      type="radio"
                      name="awsAccount"
                      checked={selectedAccountId === acc._id}
                      onChange={() => {
                        setSelectedAccountId(acc._id);
                        setShowWizard(false);
                      }}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">
                          {acc.alias}
                        </div>
                        {acc.sesSandbox && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            SES sandbox
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {acc.awsAccountId ? `AWS ${acc.awsAccountId} • ` : ""}
                        {acc.region} • bucket: {acc.s3Bucket}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {!showWizard && (
              <button
                onClick={() => {
                  setShowWizard(true);
                  setSelectedAccountId(null);
                }}
                className="w-full rounded-lg border border-dashed border-gray-300 p-3 text-left text-sm font-medium text-violet-700 transition-colors hover:border-violet-400 hover:bg-violet-50 dark:border-gray-600 dark:text-violet-300 dark:hover:bg-violet-900/20"
              >
                + Connect a new AWS account
              </button>
            )}

            {showWizard && (
              <ConnectAwsAccountWizard
                onCancel={() => setShowWizard(false)}
                onVerified={(accountId) => setSelectedAccountId(accountId)}
              />
            )}
          </div>
        )}

        {/* Error */}
        {addError && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">{addError}</p>
        )}

        {/* Footer buttons */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleAddDomain}
            disabled={!canSubmitAddDomain}
            className="flex-1 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
          >
            {isAdding ? "Adding..." : "Add Domain"}
          </button>
        </div>
      </div>
    </div>
  );
}
