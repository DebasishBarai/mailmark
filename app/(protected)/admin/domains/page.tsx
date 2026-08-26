"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

// Matches the "cleanup unverified domains" cron in convex/crons.ts, which
// deletes any domain still unverified after this many days along with its
// mailboxes and their emails.
const CLEANUP_AFTER_DAYS = 7;
// SES stops retrying DKIM verification after this long and marks it Failed.
const SES_GIVE_UP_HOURS = 72;

function StatusPill({ status }: { status?: string }) {
  if (!status) {
    return (
      <span className="rounded px-1.5 py-0.5 text-xs font-medium text-gray-400 dark:text-gray-500">
        not checked
      </span>
    );
  }
  const normalized = status.toUpperCase();
  const tone =
    normalized === "SUCCESS"
      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
      : normalized === "FAILED"
        ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
        : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400";
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tone}`}>
      {status}
    </span>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded px-1 py-0.5 text-[10px] font-semibold uppercase ${
        ok
          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
          : "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
      }`}
      title={`${label}: ${ok ? "verified" : "not verified"}`}
    >
      {label}
    </span>
  );
}

function relativeTime(timestamp?: number) {
  if (!timestamp) return "never";
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}


function KindBadge({ kind }: { kind: string }) {
  const map: Record<string, { label: string; tone: string }> = {
    dns: {
      label: "Records missing",
      tone: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    },
    waiting: {
      label: "Waiting on AWS",
      tone: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    },
    failed: {
      label: "Needs reissue",
      tone: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    },
  };
  const entry = map[kind] ?? map.dns;
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${entry.tone}`}>
      {entry.label}
    </span>
  );
}

// Preview of the exact email the owner would receive, with an optional note
// from the admin. The body itself is generated server side, so what is shown
// here is what goes out.
function PendingNoticeModal({
  domainId,
  domainName,
  onClose,
  onSent,
}: {
  domainId: Id<"domains">;
  domainName: string;
  onClose: () => void;
  onSent: (recipient: string) => void;
}) {
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const preview = useQuery(api.domains.pendingNoticePreview, {
    domainId,
    note: note.trim() || undefined,
  });
  const sendNotice = useAction(api.domainActions.adminSendPendingNotice);

  async function handleSend() {
    setSending(true);
    setSendError("");
    try {
      const result = await sendNotice({
        domainId,
        note: note.trim() || undefined,
      });
      onSent(result.recipient);
      onClose();
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Email owner about {domainName}
            </h2>
            {preview && (
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                To {preview.recipient ?? "unknown recipient"} from support@mailmark.dev
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {preview === undefined && (
            <div className="flex justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
            </div>
          )}

          {preview === null && (
            <p className="text-sm text-red-600 dark:text-red-400">Domain not found.</p>
          )}

          {preview && (
            <>
              {preview.alreadyVerified && (
                <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                  This domain is already verified. There is nothing pending to report,
                  and sending is disabled.
                </div>
              )}

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <KindBadge kind={preview.kind} />
                {preview.sentCount > 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Already emailed {preview.sentCount}{" "}
                    {preview.sentCount === 1 ? "time" : "times"}, last{" "}
                    {relativeTime(preview.sentAt)}
                  </span>
                )}
              </div>

              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Subject
              </p>
              <p className="mb-4 text-sm font-medium text-gray-900 dark:text-white">
                {preview.subject}
              </p>

              {preview.missingRecords.length > 0 && (
                <>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Pending records ({preview.missingRecords.length})
                  </p>
                  <ul className="mb-4 space-y-1">
                    {preview.missingRecords.map((record, i) => (
                      <li
                        key={`${record.type}-${record.name}-${i}`}
                        className="rounded bg-gray-50 px-2 py-1 font-mono text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      >
                        {record.type} {record.name} {"->"} {record.value}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Add a note (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Anything specific you want to tell this customer."
                className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-violet-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />

              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Preview
              </p>
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={preview.html}
                className="h-80 w-full rounded-lg border border-gray-200 bg-white dark:border-gray-700"
              />
            </>
          )}

          {sendError && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{sendError}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !preview || preview.alreadyVerified || !preview.recipient}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send email"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminDomainsPage() {
  const domains = useQuery(api.domains.listAllForAdmin);
  const verifyDomain = useAction(api.domainActions.adminVerifyDomain);
  const reverifyPending = useAction(api.domainActions.adminReverifyPendingDomains);

  const [pendingOnly, setPendingOnly] = useState(false);
  const [busyId, setBusyId] = useState<Id<"domains"> | null>(null);
  const [noticeFor, setNoticeFor] = useState<{
    id: Id<"domains">;
    name: string;
  } | null>(null);
  const [sweeping, setSweeping] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (domains === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
      </div>
    );
  }

  if (domains === null) return null;

  const unverifiedCount = domains.filter((d) => !d.verified).length;
  const rows = pendingOnly ? domains.filter((d) => !d.verified) : domains;

  async function handleVerify(domainId: Id<"domains">) {
    setBusyId(domainId);
    setError("");
    setMessage("");
    try {
      const result = await verifyDomain({ domainId });
      setMessage(
        result.verified
          ? "Domain is verified."
          : `Still pending. SES DKIM: ${result.sesDkimStatus ?? "unknown"}, MAIL FROM: ${result.sesMailFromStatus ?? "unknown"}.${result.error ? ` Error: ${result.error}` : ""}`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSweep() {
    setSweeping(true);
    setError("");
    setMessage("");
    try {
      const result = await reverifyPending();
      setMessage(
        `Checked ${result.checked} pending domain(s), ${result.verified} now verified.`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sweep failed");
    } finally {
      setSweeping(false);
    }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white md:text-2xl">
            Domains
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {domains.length} total, {unverifiedCount} awaiting SES verification.
            Pending domains are re-checked automatically every hour.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPendingOnly((v) => !v)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 md:text-sm"
          >
            {pendingOnly ? "Show all" : "Pending only"}
          </button>
          <button
            onClick={handleSweep}
            disabled={sweeping}
            className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50 md:text-sm"
          >
            {sweeping ? "Checking..." : "Verify all pending"}
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3 font-semibold">Domain</th>
              <th className="px-4 py-3 font-semibold">Owner</th>
              <th className="px-4 py-3 font-semibold">DNS</th>
              <th className="px-4 py-3 font-semibold">SES DKIM</th>
              <th className="px-4 py-3 font-semibold">SES MAIL FROM</th>
              <th className="px-4 py-3 font-semibold">Last check</th>
              <th className="px-4 py-3 font-semibold">Age</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {rows.map((domain) => {
              const ageHours = (Date.now() - domain._creationTime) / 3600000;
              const daysToCleanup = CLEANUP_AFTER_DAYS - ageHours / 24;
              const sesDeadlinePassed = ageHours > SES_GIVE_UP_HOURS;
              const dkimDnsOk =
                (domain.dkimRecordStatus?.length ?? 0) > 0 &&
                (domain.dkimRecordStatus ?? []).every(Boolean);

              return (
                <tr
                  key={domain._id}
                  className="bg-white dark:bg-gray-900/40"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {domain.domain}
                      </span>
                      {domain.verified ? (
                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-green-700 dark:bg-green-900/40 dark:text-green-400">
                          verified
                        </span>
                      ) : (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                          pending
                        </span>
                      )}
                    </div>
                    {domain.lastVerificationError && (
                      <p className="mt-1 max-w-xs truncate text-xs text-red-600 dark:text-red-400" title={domain.lastVerificationError}>
                        {domain.lastVerificationError}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {domain.ownerEmail ?? "unknown"}
                    {domain.pendingNoticeSentAt && (
                      <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                        emailed {relativeTime(domain.pendingNoticeSentAt)}
                        {(domain.pendingNoticeCount ?? 0) > 1
                          ? ` (x${domain.pendingNoticeCount})`
                          : ""}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Check ok={domain.mxVerified} label="MX" />
                      <Check ok={domain.spfVerified} label="SPF" />
                      <Check ok={dkimDnsOk} label="DKIM" />
                      <Check ok={domain.dmarcVerified} label="DMARC" />
                      <Check ok={!!domain.mailFromMxVerified} label="MF-MX" />
                      <Check ok={!!domain.mailFromSpfVerified} label="MF-SPF" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={domain.sesDkimStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={domain.sesMailFromStatus} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {relativeTime(domain.lastVerificationCheckAt)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="text-gray-500 dark:text-gray-400">
                      {Math.round(ageHours)}h old
                    </span>
                    {!domain.verified && (
                      <div className="mt-0.5">
                        {sesDeadlinePassed && (
                          <span className="block text-red-600 dark:text-red-400">
                            past SES 72h window
                          </span>
                        )}
                        <span
                          className={
                            daysToCleanup <= 2
                              ? "text-red-600 dark:text-red-400"
                              : "text-gray-400 dark:text-gray-500"
                          }
                        >
                          auto-delete in {Math.max(0, Math.floor(daysToCleanup))}d
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleVerify(domain._id)}
                        disabled={busyId === domain._id}
                        className="rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-semibold text-violet-600 transition-colors hover:bg-violet-50 disabled:opacity-50 dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-900/20"
                      >
                        {busyId === domain._id ? "Checking..." : "Re-verify"}
                      </button>
                      {!domain.verified && (
                        <button
                          onClick={() =>
                            setNoticeFor({ id: domain._id, name: domain.domain })
                          }
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          Email owner
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          No domains to show.
        </p>
      )}

      {noticeFor && (
        <PendingNoticeModal
          domainId={noticeFor.id}
          domainName={noticeFor.name}
          onClose={() => setNoticeFor(null)}
          onSent={(recipient) => {
            setError("");
            setMessage(`Setup email sent to ${recipient}.`);
          }}
        />
      )}
    </div>
  );
}
