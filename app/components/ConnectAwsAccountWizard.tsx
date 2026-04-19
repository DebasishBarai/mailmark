"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

export const AWS_REGIONS: { value: string; label: string }[] = [
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

type WizardStep = "alias" | "launch" | "done";
type DraftResult = {
  accountId: Id<"awsAccounts">;
  externalId: string;
  launchStackUrl: string;
  region: string;
};

type Props = {
  onCancel: () => void;
  onVerified?: (accountId: Id<"awsAccounts">, sandbox: boolean | null) => void;
  defaultAlias?: string;
  defaultRegion?: string;
  className?: string;
};

export function ConnectAwsAccountWizard({
  onCancel,
  onVerified,
  defaultAlias = "",
  defaultRegion = "us-east-1",
  className = "",
}: Props) {
  const createAwsDraft = useAction(api.awsAccountActions.createDraft);
  const verifyAwsAccount = useAction(api.awsAccountActions.verify);

  const [step, setStep] = useState<WizardStep>("alias");
  const [alias, setAlias] = useState(defaultAlias);
  const [region, setRegion] = useState(defaultRegion);
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [roleArn, setRoleArn] = useState("");
  const [bucket, setBucket] = useState("");
  const [sandbox, setSandbox] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleStart = async () => {
    setError("");
    const trimmed = alias.trim();
    if (!trimmed) {
      setError("Please enter a name for this AWS account.");
      return;
    }
    setBusy(true);
    try {
      const result = await createAwsDraft({ alias: trimmed, region });
      setDraft({
        accountId: result.accountId,
        externalId: result.externalId,
        launchStackUrl: result.launchStackUrl,
        region: result.region,
      });
      setStep("launch");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start");
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    if (!draft) return;
    setError("");
    if (!/^arn:aws:iam::\d{12}:role\/.+/.test(roleArn.trim())) {
      setError("RoleArn should look like arn:aws:iam::123456789012:role/...");
      return;
    }
    if (!bucket.trim()) {
      setError("BucketName is required.");
      return;
    }
    setBusy(true);
    try {
      const result = await verifyAwsAccount({
        accountId: draft.accountId,
        roleArn: roleArn.trim(),
        s3Bucket: bucket.trim(),
      });
      if (!result.verified) {
        setError(result.error ?? "Verification failed");
        return;
      }
      setSandbox(result.sesSandbox);
      setStep("done");
      onVerified?.(draft.accountId, result.sesSandbox);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`rounded-lg border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-800 dark:bg-violet-900/10 ${className}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Connect a new AWS account
        </h3>
        <button
          onClick={onCancel}
          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {step === "done" ? "Close" : "Cancel"}
        </button>
      </div>

      {/* Step 1: alias + region */}
      {step === "alias" && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Account name (for your reference)
            </label>
            <input
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="e.g. Acme Production"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              AWS region
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
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
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
          <button
            onClick={handleStart}
            disabled={busy || !alias.trim()}
            className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {busy ? "Preparing..." : "Continue"}
          </button>
        </div>
      )}

      {/* Step 2: launch stack + paste outputs */}
      {step === "launch" && draft && (
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
            href={draft.launchStackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff9900] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e68a00]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            Open CloudFormation in AWS ({draft.region})
          </a>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              RoleArn
            </label>
            <input
              type="text"
              value={roleArn}
              onChange={(e) => setRoleArn(e.target.value)}
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
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              placeholder="mailmark-123456789012-emails"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setStep("alias")}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Back
            </button>
            <button
              onClick={handleVerify}
              disabled={busy || !roleArn.trim() || !bucket.trim()}
              className="flex-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {busy ? "Verifying..." : "Verify connection"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: done */}
      {step === "done" && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-300">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <div>AWS account connected.</div>
          </div>
          {sandbox === true && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div>
                Your AWS account is in the SES <strong>sandbox</strong> — you can only send to verified recipients until you request production access from AWS. Inbound mail still works.
              </div>
            </div>
          )}
          <button
            onClick={onCancel}
            className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
