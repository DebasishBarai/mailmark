"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Doc, Id } from "../../../convex/_generated/dataModel";

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

const AWS_REGIONS: { value: string; label: string }[] = [
  { value: "us-east-1", label: "US East (N. Virginia) — us-east-1" },
  { value: "us-east-2", label: "US East (Ohio) — us-east-2" },
  { value: "us-west-2", label: "US West (Oregon) — us-west-2" },
  { value: "eu-west-1", label: "Europe (Ireland) — eu-west-1" },
  { value: "eu-west-2", label: "Europe (London) — eu-west-2" },
  { value: "eu-central-1", label: "Europe (Frankfurt) — eu-central-1" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo) — ap-northeast-1" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore) — ap-southeast-1" },
  { value: "ap-southeast-2", label: "Asia Pacific (Sydney) — ap-southeast-2" },
  { value: "ap-south-1", label: "Asia Pacific (Mumbai) — ap-south-1" },
  { value: "ca-central-1", label: "Canada (Central) — ca-central-1" },
];

type InfraChoice = "platform" | "byo";
type WizardStep = "alias" | "launch" | "verify" | "done";
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
type DraftResult = {
  accountId: Id<"awsAccounts">;
  externalId: string;
  launchStackUrl: string;
  region: string;
};

export default function DomainsPage() {
  const domains = useQuery(api.domains.listForCurrentUser);
  const awsAccounts = useQuery(api.awsAccounts.listForCurrentUser) as
    | AwsAccountSummary[]
    | undefined;
  const usageAndLimits = useQuery(api.quotas.getUsageAndLimits);
  const addDomain = useAction(api.domainActions.add);
  const createAwsDraft = useAction(api.awsAccountActions.createDraft);
  const verifyAwsAccount = useAction(api.awsAccountActions.verify);
  const isLoading = domains === undefined;

  const domainLimit = usageAndLimits?.limits.domains ?? null;
  const domainCount = usageAndLimits?.usage.domains ?? 0;
  const atDomainLimit = domainLimit !== null && domainCount >= domainLimit;

  const verifiedAccounts = useMemo(
    () => (awsAccounts ?? []).filter((a) => a.status === "verified"),
    [awsAccounts]
  );

  const [showAddModal, setShowAddModal] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState("");

  // Infrastructure picker
  const [infra, setInfra] = useState<InfraChoice>("platform");
  const [selectedAccountId, setSelectedAccountId] =
    useState<Id<"awsAccounts"> | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  // Wizard state
  const [wizardStep, setWizardStep] = useState<WizardStep>("alias");
  const [wizAlias, setWizAlias] = useState("");
  const [wizRegion, setWizRegion] = useState("us-east-1");
  const [wizDraft, setWizDraft] = useState<DraftResult | null>(null);
  const [wizRoleArn, setWizRoleArn] = useState("");
  const [wizBucket, setWizBucket] = useState("");
  const [wizSandbox, setWizSandbox] = useState<boolean | null>(null);
  const [wizError, setWizError] = useState("");
  const [wizBusy, setWizBusy] = useState(false);

  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

  // If user switches to BYO and has no verified accounts yet, auto-open wizard
  useEffect(() => {
    if (infra === "byo" && verifiedAccounts.length === 0) {
      setShowWizard(true);
    }
  }, [infra, verifiedAccounts.length]);

  const resetWizard = () => {
    setWizardStep("alias");
    setWizAlias("");
    setWizRegion("us-east-1");
    setWizDraft(null);
    setWizRoleArn("");
    setWizBucket("");
    setWizSandbox(null);
    setWizError("");
    setWizBusy(false);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setNewDomain("");
    setAddError("");
    setInfra("platform");
    setSelectedAccountId(null);
    setShowWizard(false);
    resetWizard();
  };

  const handleStartWizard = async () => {
    setWizError("");
    const alias = wizAlias.trim();
    if (!alias) {
      setWizError("Please enter a name for this AWS account.");
      return;
    }
    setWizBusy(true);
    try {
      const draft = await createAwsDraft({ alias, region: wizRegion });
      setWizDraft({
        accountId: draft.accountId,
        externalId: draft.externalId,
        launchStackUrl: draft.launchStackUrl,
        region: draft.region,
      });
      setWizardStep("launch");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to start";
      setWizError(message);
    } finally {
      setWizBusy(false);
    }
  };

  const handleVerify = async () => {
    if (!wizDraft) return;
    setWizError("");
    if (!/^arn:aws:iam::\d{12}:role\/.+/.test(wizRoleArn.trim())) {
      setWizError("RoleArn should look like arn:aws:iam::123456789012:role/...");
      return;
    }
    if (!wizBucket.trim()) {
      setWizError("BucketName is required.");
      return;
    }
    setWizBusy(true);
    try {
      const result = await verifyAwsAccount({
        accountId: wizDraft.accountId,
        roleArn: wizRoleArn.trim(),
        s3Bucket: wizBucket.trim(),
      });
      if (!result.verified) {
        setWizError(result.error ?? "Verification failed");
        return;
      }
      setWizSandbox(result.sesSandbox);
      setSelectedAccountId(wizDraft.accountId);
      setWizardStep("done");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Verification failed";
      setWizError(message);
    } finally {
      setWizBusy(false);
    }
  };

  const handleAddDomain = async () => {
    const domain = newDomain.trim().toLowerCase();
    if (!domain) return;
    if (!domainRegex.test(domain)) {
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
      closeModal();
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
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Domains</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your email domains and DNS verification.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {usageAndLimits && domainLimit !== null && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {domainCount}/{domainLimit} domain{domainLimit !== 1 ? "s" : ""} used
            </span>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            disabled={atDomainLimit}
            title={atDomainLimit ? `Domain limit reached (${domainLimit}). Upgrade your plan to add more.` : undefined}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Domain
          </button>
        </div>
      </div>

      {/* Limit reached banner */}
      {atDomainLimit && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
          <svg className="h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-amber-800 dark:text-amber-200">
            You&apos;ve reached the domain limit for your <strong>{usageAndLimits?.plan}</strong> plan ({domainLimit} domain{domainLimit !== 1 ? "s" : ""}).{" "}
            <a href="/billing" className="font-semibold underline hover:no-underline">Upgrade your plan</a> to add more domains.
          </p>
        </div>
      )}

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
            Add your first domain to get started with Mailmark.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={atDomainLimit}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                    {d.awsAccountId ? (
                      <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        Your AWS
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        Mailmark
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
                      resetWizard();
                      setShowWizard(true);
                      setSelectedAccountId(null);
                    }}
                    className="w-full rounded-lg border border-dashed border-gray-300 p-3 text-left text-sm font-medium text-violet-700 transition-colors hover:border-violet-400 hover:bg-violet-50 dark:border-gray-600 dark:text-violet-300 dark:hover:bg-violet-900/20"
                  >
                    + Connect a new AWS account
                  </button>
                )}

                {showWizard && (
                  <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-800 dark:bg-violet-900/10">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        Connect a new AWS account
                      </h3>
                      <button
                        onClick={() => {
                          setShowWizard(false);
                          resetWizard();
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Step 1: alias + region */}
                    {wizardStep === "alias" && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                            Account name (for your reference)
                          </label>
                          <input
                            type="text"
                            value={wizAlias}
                            onChange={(e) => setWizAlias(e.target.value)}
                            placeholder="e.g. Acme Production"
                            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                            AWS region
                          </label>
                          <select
                            value={wizRegion}
                            onChange={(e) => setWizRegion(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          >
                            {AWS_REGIONS.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                            SES receives inbound mail only in regions where you activate it. All resources in this stack will be created in the region you pick.
                          </p>
                        </div>
                        {wizError && (
                          <p className="text-xs text-red-600 dark:text-red-400">{wizError}</p>
                        )}
                        <button
                          onClick={handleStartWizard}
                          disabled={wizBusy || !wizAlias.trim()}
                          className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                        >
                          {wizBusy ? "Preparing..." : "Continue"}
                        </button>
                      </div>
                    )}

                    {/* Step 2: launch stack + paste outputs */}
                    {wizardStep === "launch" && wizDraft && (
                      <div className="space-y-3">
                        <ol className="list-decimal space-y-2 pl-4 text-xs text-gray-700 dark:text-gray-300">
                          <li>
                            Click the button below to open AWS CloudFormation with the Mailmark template pre-loaded.
                          </li>
                          <li>
                            Tick the IAM acknowledgment and click <strong>Create stack</strong>. Wait for status <code>CREATE_COMPLETE</code> (1–2 minutes).
                          </li>
                          <li>
                            Open the stack&apos;s <strong>Outputs</strong> tab and copy <code>RoleArn</code> and <code>BucketName</code> into the fields below.
                          </li>
                        </ol>
                        <a
                          href={wizDraft.launchStackUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff9900] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e68a00]"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                          Open CloudFormation in AWS ({wizDraft.region})
                        </a>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                            RoleArn
                          </label>
                          <input
                            type="text"
                            value={wizRoleArn}
                            onChange={(e) => setWizRoleArn(e.target.value)}
                            placeholder="arn:aws:iam::123456789012:role/MailmarkIntegrationRole-..."
                            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                            BucketName
                          </label>
                          <input
                            type="text"
                            value={wizBucket}
                            onChange={(e) => setWizBucket(e.target.value)}
                            placeholder="mailmark-123456789012-emails"
                            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                        {wizError && (
                          <p className="text-xs text-red-600 dark:text-red-400">{wizError}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => setWizardStep("alias")}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            Back
                          </button>
                          <button
                            onClick={handleVerify}
                            disabled={wizBusy || !wizRoleArn.trim() || !wizBucket.trim()}
                            className="flex-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                          >
                            {wizBusy ? "Verifying..." : "Verify connection"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Step 3: done */}
                    {wizardStep === "done" && wizDraft && (
                      <div className="space-y-3">
                        <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-300">
                          <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          <div>
                            AWS account connected. This domain will be created inside your AWS account.
                          </div>
                        </div>
                        {wizSandbox === true && (
                          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                            <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                            <div>
                              Your AWS account is in the SES <strong>sandbox</strong> — you can only send to verified recipients until you request production access from AWS. Inbound mail still works.
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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
                onClick={closeModal}
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
      )}
    </div>
  );
}
