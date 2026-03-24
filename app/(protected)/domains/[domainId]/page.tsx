"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Doc, Id } from "../../../../convex/_generated/dataModel";

export default function DomainDetailPage() {
  const { domainId } = useParams<{ domainId: string }>();
  const router = useRouter();
  const domain = useQuery(api.domains.getById, {
    domainId: domainId as Id<"domains">,
  });
  const mailboxes = useQuery(api.mailboxes.listByDomain, {
    domainId: domainId as Id<"domains">,
  });
  const createMailbox = useMutation(api.mailboxes.create);
  const removeDomain = useAction(api.domainActions.remove);
  const verifyDns = useAction(api.domainActions.verifyDns);

  const isLoading = domain === undefined || mailboxes === undefined;

  const [showCreateMailbox, setShowCreateMailbox] = useState(false);
  const [newMailbox, setNewMailbox] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
  }, []);

  const handleCreateMailbox = async () => {
    if (!newMailbox.trim()) return;
    setIsCreating(true);
    try {
      await createMailbox({
        domainId: domainId as Id<"domains">,
        address: newMailbox.trim().toLowerCase(),
        displayName: newDisplayName.trim() || undefined,
      });
      setShowCreateMailbox(false);
      setNewMailbox("");
      setNewDisplayName("");
    } finally {
      setIsCreating(false);
    }
  };

  const handleVerifyDns = async () => {
    setIsVerifying(true);
    try {
      await verifyDns({ domainId: domainId as Id<"domains"> });
    } finally {
      setIsVerifying(false);
    }
  };

const handleRemoveDomain = async () => {
    if (!confirm("Are you sure you want to remove this domain? This will also delete it from AWS SES and cannot be undone.")) return;
    setIsRemoving(true);
    try {
      await removeDomain({ domainId: domainId as Id<"domains"> });
      router.push("/domains");
    } finally {
      setIsRemoving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="mb-6 h-4 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mb-8 h-8 w-64 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mb-8 h-64 animate-pulse rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-700" />
        <div className="h-48 animate-pulse rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-700" />
      </div>
    );
  }

  if (!domain) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-900 dark:text-white">Domain not found</p>
          <Link href="/domains" className="mt-2 text-sm text-violet-600 hover:text-violet-700">
            Back to domains
          </Link>
        </div>
      </div>
    );
  }

  // Build DNS records list from SES data
  const dkimTokens: string[] = domain.sesDkimTokens ?? [];
  const region = "ap-south-1"; // Match your AWS_REGION

  const dkimRecordStatus = domain.dkimRecordStatus ?? [];

  const dnsRecords = [
    // DKIM CNAME records (3 from SES)
    ...dkimTokens.map((token, i) => ({
      type: "CNAME",
      name: `${token}._domainkey`,
      value: `${token}.dkim.amazonses.com`,
      recommendedValue: `${token}.dkim.amazonses.com`,
      purpose: `DKIM ${i + 1}`,
      verified: dkimRecordStatus[i] ?? false,
    })),
    // MX record for receiving email
    {
      type: "MX",
      name: "@",
      priority: "10",
      value: `inbound-smtp.${region}.amazonaws.com`,
      recommendedValue: `inbound-smtp.${region}.amazonaws.com`,
      currentDnsValue: domain.mxVerified ? undefined : (domain.actualMxValue ? domain.actualMxValue.replace(/^\d+\s+/, "") : undefined),
      purpose: "Receiving",
      verified: domain.mxVerified,
    },
    // SPF TXT record
    {
      type: "TXT",
      name: "@",
      value: `v=spf1 include:amazonses.com ~all`,
      recommendedValue: `v=spf1 include:amazonses.com ~all`,
      currentDnsValue: domain.spfVerified ? undefined : domain.actualSpfValue,
      purpose: "SPF",
      verified: domain.spfVerified,
    },
    // DMARC TXT record
    {
      type: "TXT",
      name: `_dmarc`,
      value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain.domain}`,
      recommendedValue: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain.domain}`,
      currentDnsValue: domain.dmarcVerified ? undefined : domain.actualDmarcValue,
      purpose: "DMARC",
      verified: domain.dmarcVerified,
    },
    // Custom MAIL FROM domain records - fixes MAIL FROM alignment in AWS SES
    {
      type: "MX",
      name: `mail`,
      priority: "10",
      value: `feedback-smtp.${region}.amazonaws.com`,
      recommendedValue: `feedback-smtp.${region}.amazonaws.com`,
      purpose: "MAIL FROM",
      verified: domain.mailFromMxVerified ?? false,
    },
    {
      type: "TXT",
      name: `mail`,
      value: `v=spf1 include:amazonses.com ~all`,
      recommendedValue: `v=spf1 include:amazonses.com ~all`,
      purpose: "MAIL FROM SPF",
      verified: domain.mailFromSpfVerified ?? false,
    },
  ];

  return (
    <div className="p-4 pb-6 md:p-8">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/domains" className="hover:text-violet-600">Domains</Link>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="font-medium text-gray-900 dark:text-white">{domain.domain}</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white md:text-2xl">{domain.domain}</h1>
            {domain.verified ? (
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Verified
              </span>
            ) : (
              <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                Pending Verification
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {mailboxes.length} mailbox{mailboxes.length !== 1 ? "es" : ""} configured
          </p>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={handleVerifyDns}
            disabled={isVerifying}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50 md:px-4 md:py-2.5 md:text-sm"
          >
            {isVerifying ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Checking...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
                {domain.verified ? "Re-verify DNS" : "Verify DNS"}
              </>
            )}
          </button>
          <button
            onClick={handleRemoveDomain}
            disabled={isRemoving}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 md:px-4 md:py-2.5 md:text-sm"
          >
            {isRemoving ? "Removing..." : "Remove Domain"}
          </button>
        </div>
      </div>

      {/* DNS Records */}
      <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 md:mb-8">
        <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-700/50 md:px-6 md:py-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">DNS Records</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Add these records to your domain&apos;s DNS settings. DKIM verification can take up to 72 hours.
          </p>
        </div>

        {dkimTokens.length === 0 ? (
          <div className="px-4 py-8 text-center md:px-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No DKIM tokens found. This domain may not have been registered with SES properly.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile card layout */}
            <div className="divide-y divide-gray-100 dark:divide-gray-700/30 md:hidden">
              {dnsRecords.map((record, i) => (
                <div key={i} className="overflow-hidden px-4 py-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-900 dark:text-white">{record.purpose}</span>
                      <span className="font-mono text-xs font-medium text-violet-600">{record.type}</span>
                      {"priority" in record && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">Pri: {record.priority}</span>
                      )}
                    </div>
                    {record.verified ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                        Pending
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="mb-0.5 block text-[10px] font-medium uppercase text-gray-400 dark:text-gray-500">Name</span>
                      <div className="flex items-center gap-1.5">
                        <code className="block min-w-0 break-all rounded bg-gray-100 px-1.5 py-1 text-[11px] leading-relaxed text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                          {record.name}
                        </code>
                        <button
                          onClick={() => handleCopy(record.name, `name-${i}`)}
                          className="shrink-0 self-start rounded p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                        >
                          {copiedKey === `name-${i}` ? (
                            <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          ) : (
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="mb-0.5 block text-[10px] font-medium uppercase text-gray-400 dark:text-gray-500">Value</span>
                      <div className="flex items-start gap-1.5">
                        <code className="block min-w-0 break-all rounded bg-gray-100 px-1.5 py-1 text-[11px] leading-relaxed text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                          {record.value}
                        </code>
                        <button
                          onClick={() => handleCopy(record.recommendedValue, `value-${i}`)}
                          className="shrink-0 self-start rounded p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                        >
                          {copiedKey === `value-${i}` ? (
                            <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          ) : (
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                            </svg>
                          )}
                        </button>
                      </div>
                      {"currentDnsValue" in record && record.currentDnsValue && record.currentDnsValue !== record.recommendedValue && (
                        <div className="mt-1 flex items-start gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                          <svg className="mt-0.5 h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                          </svg>
                          <span className="break-all">Currently in DNS: <code className="rounded bg-amber-50 px-1 dark:bg-amber-900/30">{record.currentDnsValue}</code></span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table layout */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left dark:border-gray-700/50 dark:bg-gray-700">
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Purpose</th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Type</th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Name</th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Priority</th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Value</th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/30">
                  {dnsRecords.map((record, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="whitespace-nowrap px-6 py-3 text-xs font-medium text-gray-900 dark:text-white">
                        {record.purpose}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 font-mono text-xs font-medium text-violet-600">
                        {record.type}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <code className="max-w-[200px] truncate rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            {record.name}
                          </code>
                          <button
                            onClick={() => handleCopy(record.name, `name-${i}`)}
                            className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                            title="Copy"
                          >
                            {copiedKey === `name-${i}` ? (
                              <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            ) : (
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                        {"priority" in record ? record.priority : <span className="text-gray-300 dark:text-gray-600">-</span>}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <code className="max-w-[250px] truncate rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                              {record.value}
                            </code>
                            <button
                              onClick={() => handleCopy(record.recommendedValue, `value-${i}`)}
                              className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                              title="Copy"
                            >
                              {copiedKey === `value-${i}` ? (
                                <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              ) : (
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                                </svg>
                              )}
                            </button>
                          </div>
                          {"currentDnsValue" in record && record.currentDnsValue && record.currentDnsValue !== record.recommendedValue && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                              <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                              </svg>
                              <span>Currently in DNS: <code className="rounded bg-amber-50 px-1 dark:bg-amber-900/30">{record.currentDnsValue}</code></span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-3">
                        {record.verified ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!domain.verified && (
          <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-700/50 md:px-6">
            <button
              onClick={handleVerifyDns}
              disabled={isVerifying}
              className="text-sm font-medium text-violet-600 hover:text-violet-700 disabled:opacity-50"
            >
              {isVerifying ? "Checking..." : "Check verification status"}
            </button>
          </div>
        )}
      </div>

      {/* Mailboxes */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700/50 md:px-6 md:py-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Mailboxes</h2>
          <div className="group relative">
            <button
              onClick={() => setShowCreateMailbox(true)}
              disabled={!domain.verified}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Create Mailbox
            </button>
            {!domain.verified && (
              <div className="pointer-events-none absolute right-0 top-full z-10 mt-1 w-56 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 opacity-0 shadow-md transition-opacity group-hover:opacity-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                Complete domain verification before creating mailboxes.
              </div>
            )}
          </div>
        </div>
        {mailboxes.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mb-4 text-5xl">📬</div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">No mailboxes yet</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {domain.verified
                ? `Create your first mailbox for ${domain.domain}.`
                : "Verify your domain DNS records before creating mailboxes."}
            </p>
            <button
              onClick={() => setShowCreateMailbox(true)}
              disabled={!domain.verified}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Create First Mailbox
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-700/30">
            {mailboxes.map((mb: Doc<"mailboxes">) => (
              <Link
                key={mb._id}
                href={`/mailbox/${mb._id}`}
                className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">
                    {mb.address[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{mb.fullAddress}</p>
                    {mb.displayName && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{mb.displayName}</p>
                    )}
                  </div>
                </div>
                <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create mailbox modal */}
      {showCreateMailbox && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-2xl dark:bg-gray-800 md:rounded-2xl md:p-8">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Create Mailbox</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Create a new email address for {domain.domain}.
            </p>
            <div className="mt-6">
              <label htmlFor="mailbox" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email address
              </label>
              <div className="mt-1 flex items-center">
                <input
                  id="mailbox"
                  type="text"
                  value={newMailbox}
                  onChange={(e) => setNewMailbox(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateMailbox()}
                  placeholder="name"
                  className="w-full rounded-l-lg border border-r-0 border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
                />
                <span className="rounded-r-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-400">
                  @{domain.domain}
                </span>
              </div>
            </div>
            <div className="mt-4">
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Display name (optional)
              </label>
              <input
                id="displayName"
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateMailbox()}
                placeholder="Sales Team"
                className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
              />
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowCreateMailbox(false);
                  setNewMailbox("");
                  setNewDisplayName("");
                }}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMailbox}
                disabled={!newMailbox.trim() || isCreating}
                className="flex-1 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
              >
                {isCreating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
