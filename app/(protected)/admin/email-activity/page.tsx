"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type WindowOption = { label: string; days?: number };

const WINDOWS: WindowOption[] = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "1 year", days: 365 },
  { label: "All time" },
];

function formatDateTime(ms: number) {
  return new Date(ms).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeTime(ms: number) {
  const diff = ms - Date.now();
  const future = diff > 0;
  const minutes = Math.round(Math.abs(diff) / 60000);
  if (minutes < 1) return "just now";
  const render = (value: number, unit: string) =>
    future ? `in ${value}${unit}` : `${value}${unit} ago`;
  if (minutes < 60) return render(minutes, "m");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return render(hours, "h");
  return render(Math.round(hours / 24), "d");
}

function StatCard({
  label,
  value,
  sub,
  color = "violet",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: "violet" | "green" | "blue" | "amber" | "red" | "gray";
}) {
  const colors = {
    violet: "text-violet-600 dark:text-violet-400",
    green: "text-green-600 dark:text-green-400",
    blue: "text-blue-600 dark:text-blue-400",
    amber: "text-amber-600 dark:text-amber-400",
    red: "text-red-600 dark:text-red-400",
    gray: "text-gray-700 dark:text-gray-300",
  };
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${colors[color]}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
    </div>
  );
}

function StatusPill({ status }: { status: "sent" | "scheduled" }) {
  const tone =
    status === "scheduled"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
      : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${tone}`}>
      {status}
    </span>
  );
}

function DeliveryPill({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-gray-400 dark:text-gray-500">n/a</span>;
  const tone =
    status === "delivered"
      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
      : status === "pending"
        ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
        : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${tone}`}>
      {status}
    </span>
  );
}

// Recipients are shown inline, but a send to a large list would otherwise
// blow the row height out. The rest are revealed on click.
function RecipientCell({
  to,
  cc,
  bcc,
}: {
  to: string[];
  cc: string[];
  bcc: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const all = [
    ...to.map((address) => ({ address, kind: "to" })),
    ...cc.map((address) => ({ address, kind: "cc" })),
    ...bcc.map((address) => ({ address, kind: "bcc" })),
  ];
  if (all.length === 0) {
    return <span className="text-xs text-gray-400 dark:text-gray-500">no recipients</span>;
  }
  const shown = expanded ? all : all.slice(0, 3);
  return (
    <div className="flex flex-col gap-0.5">
      {shown.map((entry, index) => (
        <span key={`${entry.address}-${index}`} className="break-all text-xs text-gray-600 dark:text-gray-300">
          {entry.kind !== "to" && (
            <span className="mr-1 text-[10px] uppercase text-gray-400 dark:text-gray-500">
              {entry.kind}
            </span>
          )}
          {entry.address}
        </span>
      ))}
      {all.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="self-start text-[11px] font-medium text-violet-600 hover:underline dark:text-violet-400"
        >
          {expanded ? "show less" : `+${all.length - 3} more`}
        </button>
      )}
    </div>
  );
}

function toCsv(rows: (string | number)[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "");
          return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(",")
    )
    .join("\n");
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminEmailActivityPage() {
  const domains = useQuery(api.adminEmailActivity.listDomains);

  const [domainId, setDomainId] = useState<Id<"domains"> | "">("");
  const [domainFilter, setDomainFilter] = useState("");
  const [windowIndex, setWindowIndex] = useState(1); // 30 days
  const [tab, setTab] = useState<"emails" | "recipients" | "bounced">("emails");
  // The bounced tab has two readings of the same rows: one line per address
  // (the suppression list) or one line per message (why it bounced).
  const [bounceView, setBounceView] = useState<"recipients" | "messages">("recipients");
  const [rowFilter, setRowFilter] = useState("");
  const [repeatedOnly, setRepeatedOnly] = useState(false);

  const activity = useQuery(
    api.adminEmailActivity.getDomainEmailActivity,
    domainId ? { domainId, days: WINDOWS[windowIndex].days } : "skip"
  );

  // Only loaded once the tab is opened. It is a second full scan of the sent
  // folder, and most visits to this page are not about bounces.
  const bounces = useQuery(
    api.adminEmailActivity.getBouncedRecipients,
    domainId && tab === "bounced"
      ? { domainId, days: WINDOWS[windowIndex].days }
      : "skip"
  );

  const visibleDomains = useMemo(() => {
    if (!domains) return [];
    const needle = domainFilter.trim().toLowerCase();
    if (!needle) return domains;
    return domains.filter(
      (d) =>
        d.domain.toLowerCase().includes(needle) ||
        (d.ownerEmail ?? "").toLowerCase().includes(needle)
    );
  }, [domains, domainFilter]);

  const filteredRows = useMemo(() => {
    if (!activity) return [];
    const needle = rowFilter.trim().toLowerCase();
    if (!needle) return activity.rows;
    return activity.rows.filter((row) => {
      const haystack = [
        row.subject,
        row.mailbox,
        row.from,
        ...row.to,
        ...row.cc,
        ...row.bcc,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [activity, rowFilter]);

  const filteredRecipients = useMemo(() => {
    if (!activity) return [];
    const needle = rowFilter.trim().toLowerCase();
    return activity.recipients.filter((recipient) => {
      if (repeatedOnly && recipient.count < 2) return false;
      if (!needle) return true;
      return (
        recipient.email.includes(needle) ||
        (recipient.name ?? "").toLowerCase().includes(needle)
      );
    });
  }, [activity, rowFilter, repeatedOnly]);

  const filteredBounceRecipients = useMemo(() => {
    if (!bounces) return [];
    const needle = rowFilter.trim().toLowerCase();
    if (!needle) return bounces.recipients;
    return bounces.recipients.filter(
      (recipient) =>
        recipient.email.includes(needle) ||
        (recipient.name ?? "").toLowerCase().includes(needle)
    );
  }, [bounces, rowFilter]);

  const filteredBounceMessages = useMemo(() => {
    if (!bounces) return [];
    const needle = rowFilter.trim().toLowerCase();
    if (!needle) return bounces.messages;
    return bounces.messages.filter((message) =>
      [message.subject, message.mailbox, ...message.to, ...message.cc, ...message.bcc]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [bounces, rowFilter]);

  if (domains === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
      </div>
    );
  }

  const totals = activity?.totals;
  const repeatShare =
    totals && totals.recipientSlots > 0
      ? Math.round((totals.repeatSends / totals.recipientSlots) * 100)
      : 0;

  function exportEmails() {
    if (!activity) return;
    downloadCsv(`${activity.domain.domain}-emails.csv`, [
      ["When", "Status", "Mailbox", "Subject", "Recipients", "To", "Cc", "Bcc", "Delivery", "Opened", "Replied", "Clicks"],
      ...filteredRows.map((row) => [
        new Date(row.at).toISOString(),
        row.status,
        row.mailbox,
        row.subject,
        row.recipientCount,
        row.to.join("; "),
        row.cc.join("; "),
        row.bcc.join("; "),
        row.deliveryStatus ?? "",
        row.openedAt ? new Date(row.openedAt).toISOString() : "",
        row.repliedAt ? new Date(row.repliedAt).toISOString() : "",
        row.clickCount,
      ]),
    ]);
  }

  function exportRecipients() {
    if (!activity) return;
    downloadCsv(`${activity.domain.domain}-recipients.csv`, [
      ["Recipient", "Name", "Times", "Sent", "Scheduled", "First", "Last"],
      ...filteredRecipients.map((recipient) => [
        recipient.email,
        recipient.name ?? "",
        recipient.count,
        recipient.sentCount,
        recipient.scheduledCount,
        new Date(recipient.firstAt).toISOString(),
        new Date(recipient.lastAt).toISOString(),
      ]),
    ]);
  }

  function exportBounces() {
    if (!bounces) return;
    if (bounceView === "recipients") {
      downloadCsv(`${bounces.domain.domain}-bounced-recipients.csv`, [
        ["Recipient", "Name", "Bounces", "Bounced", "Failed", "First", "Last", "Mailboxes", "Last subject"],
        ...filteredBounceRecipients.map((recipient) => [
          recipient.email,
          recipient.name ?? "",
          recipient.bounces,
          recipient.bounced,
          recipient.failed,
          new Date(recipient.firstAt).toISOString(),
          new Date(recipient.lastAt).toISOString(),
          recipient.mailboxes.join("; "),
          recipient.lastSubject,
        ]),
      ]);
      return;
    }
    downloadCsv(`${bounces.domain.domain}-bounced-emails.csv`, [
      ["When", "Status", "Mailbox", "Subject", "Recipients", "To", "Cc", "Bcc"],
      ...filteredBounceMessages.map((message) => [
        new Date(message.at).toISOString(),
        message.deliveryStatus ?? "",
        message.mailbox,
        message.subject,
        message.recipientCount,
        message.to.join("; "),
        message.cc.join("; "),
        message.bcc.join("; "),
      ]),
    ]);
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <Link
          href="/admin"
          className="text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
        >
          &larr; Admin
        </Link>
        <h1 className="mt-2 text-xl font-bold text-gray-900 dark:text-white md:text-2xl">
          Email Activity
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Pick a domain to see every message its mailboxes have sent or have scheduled to send,
          with recipients, timings, and how often each recipient has been contacted.
        </p>
      </div>

      {/* Domain picker */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[240px] flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Search domains
            </label>
            <input
              value={domainFilter}
              onChange={(event) => setDomainFilter(event.target.value)}
              placeholder="domain or owner email"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>
          <div className="min-w-[280px] flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Domain
            </label>
            <select
              value={domainId}
              onChange={(event) => setDomainId(event.target.value as Id<"domains"> | "")}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-violet-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option value="">Select a domain...</option>
              {visibleDomains.map((domain) => (
                <option key={domain._id} value={domain._id}>
                  {domain.domain}
                  {domain.verified ? "" : " (unverified)"}
                  {" · "}
                  {domain.sentAllTime.toLocaleString()} sent
                  {domain.scheduledAllTime > 0
                    ? `, ${domain.scheduledAllTime.toLocaleString()} scheduled`
                    : ""}
                  {domain.ownerEmail ? ` (${domain.ownerEmail})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Sent within
            </label>
            <div className="flex gap-1 rounded-md border border-gray-300 p-1 dark:border-gray-600">
              {WINDOWS.map((option, index) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setWindowIndex(index)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    windowIndex === index
                      ? "bg-violet-600 text-white"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          The window applies to sent mail. Scheduled mail is always shown in full, since a pending
          send is due in the future.
        </p>
      </div>

      {!domainId && (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select a domain above to load its email activity.
          </p>
        </div>
      )}

      {domainId && activity === undefined && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
        </div>
      )}

      {domainId && activity === null && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          That domain no longer exists.
        </div>
      )}

      {activity && totals && (
        <>
          {/* Domain summary */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {activity.domain.domain}
            </h2>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                activity.domain.verified
                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
              }`}
            >
              {activity.domain.verified ? "verified" : "pending"}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {activity.domain.ownerEmail ?? "unknown owner"}
            </span>
            <span className="text-sm text-gray-400 dark:text-gray-500">
              {activity.mailboxes.length} mailbox{activity.mailboxes.length === 1 ? "" : "es"}
            </span>
          </div>

          {activity.truncated && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
              This domain has more mail than one query may read, so the figures below cover the{" "}
              {activity.scannedCount.toLocaleString()} most recent messages
              (cap {activity.scanCap.toLocaleString()}) rather than everything. Narrow the window
              for a complete picture of a shorter period.
            </div>
          )}

          {/* Volume */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard
              label="Emails"
              value={totals.emails}
              color="violet"
              sub={WINDOWS[windowIndex].days ? `last ${WINDOWS[windowIndex].days} days` : "all time"}
            />
            <StatCard label="Sent" value={totals.sent} color="green" sub={`${totals.sentAllTime.toLocaleString()} all time`} />
            <StatCard
              label="Scheduled"
              value={totals.scheduled}
              color="amber"
              sub="queued, not yet sent"
            />
            <StatCard label="Delivered" value={totals.delivered} color="blue" />
            <StatCard label="Opened" value={totals.opened} color="blue" />
            <StatCard
              label="Bounced / failed"
              value={totals.bounced + totals.failed}
              color="red"
            />
          </div>

          {/* Recipients */}
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Recipients
          </h3>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard
              label="Total recipients"
              value={totals.recipientSlots}
              color="violet"
              sub="counting repeats"
            />
            <StatCard
              label="Unique recipients"
              value={totals.uniqueRecipients}
              color="blue"
              sub="distinct addresses"
            />
            <StatCard
              label="Repeated recipients"
              value={totals.repeatedRecipients}
              color="amber"
              sub="contacted more than once"
            />
            <StatCard
              label="Repeat sends"
              value={totals.repeatSends}
              color="amber"
              sub={`${repeatShare}% of all sends`}
            />
            <StatCard
              label="Most contacted"
              value={totals.maxRepeat}
              color="gray"
              sub="times, single address"
            />
          </div>

          {/* Tabs */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-1">
              {(["emails", "recipients", "bounced"] as const).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setTab(name)}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors ${
                    tab === name
                      ? "border-violet-600 text-violet-700 dark:border-violet-400 dark:text-violet-300"
                      : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  {name}
                  <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">
                    {name === "emails"
                      ? activity.rows.length.toLocaleString()
                      : name === "recipients"
                        ? activity.recipients.length.toLocaleString()
                        : bounces
                          ? bounces.recipients.length.toLocaleString()
                          : ""}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 pb-2">
              {tab === "bounced" && (
                <div className="flex rounded-md border border-gray-300 dark:border-gray-600">
                  {(["recipients", "messages"] as const).map((view) => (
                    <button
                      key={view}
                      type="button"
                      onClick={() => setBounceView(view)}
                      className={`px-2.5 py-1 text-xs font-medium capitalize first:rounded-l-md last:rounded-r-md ${
                        bounceView === view
                          ? "bg-violet-600 text-white"
                          : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                      }`}
                    >
                      {view}
                    </button>
                  ))}
                </div>
              )}
              {tab === "recipients" && (
                <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={repeatedOnly}
                    onChange={(event) => setRepeatedOnly(event.target.checked)}
                    className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  repeated only
                </label>
              )}
              <input
                value={rowFilter}
                onChange={(event) => setRowFilter(event.target.value)}
                placeholder={
                  tab === "emails" || (tab === "bounced" && bounceView === "messages")
                    ? "filter by subject or recipient"
                    : "filter recipients"
                }
                className="w-56 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              <button
                type="button"
                onClick={
                  tab === "emails"
                    ? exportEmails
                    : tab === "bounced"
                      ? exportBounces
                      : exportRecipients
                }
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Export CSV
              </button>
            </div>
          </div>

          {tab === "emails" && (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">When</th>
                    <th className="px-4 py-3 font-medium">Subject</th>
                    <th className="px-4 py-3 font-medium">From</th>
                    <th className="px-4 py-3 font-medium">Recipients</th>
                    <th className="px-4 py-3 text-right font-medium">Count</th>
                    <th className="px-4 py-3 font-medium">Delivery</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        No sent or scheduled mail matches.
                      </td>
                    </tr>
                  )}
                  {filteredRows.map((row) => (
                    <tr key={row._id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StatusPill status={row.status} />
                        </div>
                        <div className="mt-1 text-xs text-gray-700 dark:text-gray-300">
                          {formatDateTime(row.at)}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          {relativeTime(row.at)}
                        </div>
                      </td>
                      <td className="max-w-xs px-4 py-3">
                        <div className="truncate font-medium text-gray-900 dark:text-white" title={row.subject}>
                          {row.subject || "(no subject)"}
                        </div>
                        <div className="truncate text-xs text-gray-400 dark:text-gray-500" title={row.snippet}>
                          {row.snippet}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                        {row.mailbox}
                      </td>
                      <td className="max-w-sm px-4 py-3">
                        <RecipientCell to={row.to} cc={row.cc} bcc={row.bcc} />
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-200">
                        {row.recipientCount}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <DeliveryPill status={row.deliveryStatus} />
                        <div className="mt-1 flex gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                          {row.openedAt && <span>opened</span>}
                          {row.repliedAt && <span>replied</span>}
                          {row.clickCount > 0 && <span>{row.clickCount} clicks</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {activity.rowsTruncated && (
                <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
                  Showing the {activity.rowCap.toLocaleString()} most recent messages. Narrow the
                  window to see older ones.
                </p>
              )}
            </div>
          )}

          {tab === "recipients" && (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Recipient</th>
                    <th className="px-4 py-3 text-right font-medium">Times</th>
                    <th className="px-4 py-3 text-right font-medium">Sent</th>
                    <th className="px-4 py-3 text-right font-medium">Scheduled</th>
                    <th className="px-4 py-3 font-medium">First</th>
                    <th className="px-4 py-3 font-medium">Last</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredRecipients.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        No recipients match.
                      </td>
                    </tr>
                  )}
                  {filteredRecipients.map((recipient) => (
                    <tr key={recipient.email}>
                      <td className="px-4 py-3">
                        <div className="break-all font-medium text-gray-900 dark:text-white">
                          {recipient.email}
                        </div>
                        {recipient.name && (
                          <div className="text-xs text-gray-400 dark:text-gray-500">{recipient.name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                            recipient.count > 1
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                              : "text-gray-600 dark:text-gray-300"
                          }`}
                        >
                          {recipient.count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                        {recipient.sentCount}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                        {recipient.scheduledCount}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {formatDateTime(recipient.firstAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {formatDateTime(recipient.lastAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {activity.recipientsTruncated && (
                <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
                  Showing the {activity.recipientCap.toLocaleString()} most contacted addresses.
                </p>
              )}
            </div>
          )}

          {tab === "bounced" && bounces === undefined && (
            <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white py-16 dark:border-gray-700 dark:bg-gray-800">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
            </div>
          )}

          {tab === "bounced" && bounces && (
            <>
              {/*
                Bounce coverage is its own read, not a slice of the numbers
                above. The scan here skips the outbox (a queued message cannot
                have bounced) and spreads its budget evenly over the mailboxes,
                so it usually reaches far more sent mail than the mixed scan
                behind the Emails tab. That also means the two bounce figures on
                this page can differ, and this line is what explains why.
              */}
              <div
                className={`mb-4 rounded-lg border p-3 text-sm ${
                  bounces.truncated
                    ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                    : "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
                }`}
              >
                {bounces.truncated ? (
                  <>
                    Read {bounces.sentScanned.toLocaleString()} sent messages across all{" "}
                    {bounces.mailboxCount.toLocaleString()} mailboxes, up to the{" "}
                    {bounces.scanCap.toLocaleString()} row cap. The domain has{" "}
                    {bounces.sentAllTime.toLocaleString()} sent all time, so bounces older
                    than this reach are not listed. Narrow the window to be sure of a
                    shorter period.
                  </>
                ) : bounces.windowDays === null ? (
                  <>
                    Read all {bounces.sentScanned.toLocaleString()} sent messages this domain
                    has, across {bounces.mailboxCount.toLocaleString()} mailboxes. This is
                    every bounce on record for it.
                  </>
                ) : (
                  <>
                    Read all {bounces.sentScanned.toLocaleString()} messages sent in the last{" "}
                    {bounces.windowDays} days, across {bounces.mailboxCount.toLocaleString()}{" "}
                    mailboxes. Complete for this window. Switch to All time for the full
                    history.
                  </>
                )}
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard
                  label="Bounced recipients"
                  value={bounces.totals.recipients}
                  color="red"
                  sub="distinct addresses"
                />
                <StatCard
                  label="Bounced messages"
                  value={bounces.totals.bounceMessages}
                  color="red"
                  sub={`${bounces.totals.bounced.toLocaleString()} bounced, ${bounces.totals.failed.toLocaleString()} failed`}
                />
                <StatCard
                  label="Bounce rate"
                  value={`${(bounces.totals.rate * 100).toFixed(2)}%`}
                  color={bounces.totals.rate > 0.05 ? "red" : "amber"}
                  sub="of sent mail read"
                />
                <StatCard
                  label="Sent read"
                  value={bounces.sentScanned}
                  color="gray"
                  sub={`of ${bounces.sentAllTime.toLocaleString()} all time`}
                />
              </div>

              {bounceView === "recipients" && (
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      <tr>
                        <th className="px-4 py-3 font-medium">Recipient</th>
                        <th className="px-4 py-3 text-right font-medium">Bounces</th>
                        <th className="px-4 py-3 text-right font-medium">Bounced</th>
                        <th className="px-4 py-3 text-right font-medium">Failed</th>
                        <th className="px-4 py-3 font-medium">Last bounce</th>
                        <th className="px-4 py-3 font-medium">Sent from</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {filteredBounceRecipients.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                            No bounced recipients in this window.
                          </td>
                        </tr>
                      )}
                      {filteredBounceRecipients.map((recipient) => (
                        <tr key={recipient.email}>
                          <td className="px-4 py-3">
                            <div className="break-all font-medium text-gray-900 dark:text-white">
                              {recipient.email}
                            </div>
                            {recipient.name && (
                              <div className="text-xs text-gray-400 dark:text-gray-500">
                                {recipient.name}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-400">
                              {recipient.bounces}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                            {recipient.bounced}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                            {recipient.failed}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                            {formatDateTime(recipient.lastAt)}
                            <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                              {relativeTime(recipient.lastAt)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                            {recipient.mailboxes.slice(0, 2).join(", ")}
                            {recipient.mailboxes.length > 2 &&
                              ` +${recipient.mailboxes.length - 2}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {bounces.recipientsTruncated && (
                    <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
                      Showing the {bounces.recipientCap.toLocaleString()} most bounced addresses.
                    </p>
                  )}
                </div>
              )}

              {bounceView === "messages" && (
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      <tr>
                        <th className="px-4 py-3 font-medium">When</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Subject</th>
                        <th className="px-4 py-3 font-medium">From</th>
                        <th className="px-4 py-3 font-medium">Recipients</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {filteredBounceMessages.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                            No bounced messages in this window.
                          </td>
                        </tr>
                      )}
                      {filteredBounceMessages.map((message) => (
                        <tr key={message._id}>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                            {formatDateTime(message.at)}
                            <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                              {relativeTime(message.at)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <DeliveryPill status={message.deliveryStatus} />
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                            {message.subject || "(no subject)"}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                            {message.mailbox}
                          </td>
                          <td className="px-4 py-3">
                            <RecipientCell to={message.to} cc={message.cc} bcc={message.bcc} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {bounces.messagesTruncated && (
                    <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
                      Showing the {bounces.rowCap.toLocaleString()} most recent bounced messages.
                    </p>
                  )}
                </div>
              )}

              {/*
                A bounce is recorded against the message row, and a row carries
                every address the message was addressed to. Campaign sends are
                one row per recipient, so the attribution is exact there. A
                hand-composed mail to several people is one row, so all of its
                addresses appear here when it bounces for one of them.
              */}
              <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                SES reports a bounce against a message. For campaign sends that is one
                message per recipient, so each address above bounced. Where a single
                message went to several addresses, all of them are listed even if only
                one of them bounced.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
