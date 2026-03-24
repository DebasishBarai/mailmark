"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type Placement = "inbox" | "promotions" | "spam" | "not_received";

const PLACEMENT_CONFIG: Record<Placement, { label: string; color: string; bg: string; icon: string }> = {
  inbox: { label: "Inbox / Primary", color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-900/30", icon: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  promotions: { label: "Promotions", color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-900/30", icon: "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" },
  spam: { label: "Spam", color: "text-red-700 dark:text-red-300", bg: "bg-red-50 dark:bg-red-900/30", icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" },
  not_received: { label: "Not Received", color: "text-gray-500 dark:text-gray-400", bg: "bg-gray-100 dark:bg-gray-700", icon: "M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
};

export default function InboxPlacementPage() {
  const tests = useQuery(api.inboxPlacement.listForCurrentUser) ?? [];
  const seedAccounts = useQuery(api.inboxPlacement.getSeedAccounts) ?? [];
  const mailboxes = useQuery(api.mailboxes.listForCurrentUser) ?? [];
  const createTest = useMutation(api.inboxPlacement.createTest);
  const markSending = useMutation(api.inboxPlacement.markTestSending);
  const markWaiting = useMutation(api.inboxPlacement.markTestWaiting);
  const reportPlacement = useMutation(api.inboxPlacement.reportPlacement);
  const sendEmail = useAction(api.ses.sendEmail);

  const [showNewTest, setShowNewTest] = useState(false);
  const [selectedMailbox, setSelectedMailbox] = useState<Id<"mailboxes"> | "">("");
  const [subject, setSubject] = useState("Inbox Placement Test");
  const [htmlBody, setHtmlBody] = useState("<p>This is a test email to check inbox placement across different providers.</p><p>If you're reading this, the email was delivered successfully.</p>");
  const [selectedSeeds, setSelectedSeeds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTestId, setExpandedTestId] = useState<Id<"inboxPlacementTests"> | null>(null);

  const toggleSeed = (email: string) => {
    setSelectedSeeds((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const selectAllSeeds = () => {
    if (selectedSeeds.length === seedAccounts.length) {
      setSelectedSeeds([]);
    } else {
      setSelectedSeeds(seedAccounts.map((s) => s.email));
    }
  };

  const handleCreateAndSend = async () => {
    if (!selectedMailbox || selectedSeeds.length === 0) return;
    setSending(true);
    setError(null);

    try {
      // 1. Create test record
      const testId = await createTest({
        mailboxId: selectedMailbox as Id<"mailboxes">,
        subject,
        htmlBody,
        seedEmails: selectedSeeds,
      });

      // 2. Mark as sending
      await markSending({ testId });

      // 3. Send emails to each seed address
      for (const seedEmail of selectedSeeds) {
        await sendEmail({
          mailboxId: selectedMailbox as Id<"mailboxes">,
          to: [seedEmail],
          subject: `[Placement Test] ${subject}`,
          body: htmlBody,
          folder: "sent",
        });
      }

      // 4. Mark as waiting for results
      await markWaiting({ testId });

      setShowNewTest(false);
      setSelectedSeeds([]);
      setExpandedTestId(testId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send test");
    } finally {
      setSending(false);
    }
  };

  const handleReport = async (testId: Id<"inboxPlacementTests">, seedEmail: string, placement: Placement) => {
    await reportPlacement({ testId, seedEmail, placement });
  };

  const getPlacementSummary = (results: Array<{ placement?: string }>) => {
    const counts: Record<string, number> = {};
    for (const r of results) {
      const p = r.placement ?? "pending";
      counts[p] = (counts[p] ?? 0) + 1;
    }
    return counts;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-900 md:p-10">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inbox Placement Testing</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Send test emails to seed accounts and verify placement across Gmail, Outlook, Yahoo, and more.
            </p>
          </div>
          <button
            onClick={() => setShowNewTest(!showNewTest)}
            className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
          >
            {showNewTest ? "Cancel" : "New Test"}
          </button>
        </div>

        {/* New Test Form */}
        {showNewTest && (
          <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Placement Test</h2>

            {/* Mailbox selection */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Send From</label>
              <select
                value={selectedMailbox}
                onChange={(e) => setSelectedMailbox(e.target.value as Id<"mailboxes">)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              >
                <option value="">Select a mailbox</option>
                {mailboxes.map((m) => (
                  <option key={m._id} value={m._id}>{m.fullAddress}</option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subject Line</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>

            {/* HTML Body */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Body (HTML)</label>
              <textarea
                value={htmlBody}
                onChange={(e) => setHtmlBody(e.target.value)}
                rows={5}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Seed accounts */}
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Seed Accounts</label>
                <button
                  onClick={selectAllSeeds}
                  className="text-xs font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400"
                >
                  {selectedSeeds.length === seedAccounts.length ? "Deselect All" : "Select All"}
                </button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {seedAccounts.map((seed) => (
                  <label
                    key={seed.email}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                      selectedSeeds.includes(seed.email)
                        ? "border-violet-300 bg-violet-50 dark:border-violet-600 dark:bg-violet-900/20"
                        : "border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSeeds.includes(seed.email)}
                      onChange={() => toggleSeed(seed.email)}
                      className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{seed.label}</p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">{seed.email}</p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                You can also use your own seed email addresses. Add them to the list above via the Seed Accounts settings, or enter custom ones below.
              </p>
            </div>

            {/* Custom seed emails */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Custom Seed Email (optional)</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="email"
                  id="custom-seed"
                  placeholder="your-test@gmail.com"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const input = e.currentTarget;
                      const email = input.value.trim();
                      if (email && !selectedSeeds.includes(email)) {
                        setSelectedSeeds((prev) => [...prev, email]);
                        input.value = "";
                      }
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const input = document.getElementById("custom-seed") as HTMLInputElement;
                    const email = input?.value?.trim();
                    if (email && !selectedSeeds.includes(email)) {
                      setSelectedSeeds((prev) => [...prev, email]);
                      input.value = "";
                    }
                  }}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Send button */}
            <div className="mt-6 flex items-center gap-4">
              <button
                onClick={handleCreateAndSend}
                disabled={!selectedMailbox || selectedSeeds.length === 0 || !subject.trim() || sending}
                className="rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
              >
                {sending ? "Sending Test..." : `Send to ${selectedSeeds.length} Seed${selectedSeeds.length !== 1 ? "s" : ""}`}
              </button>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            </div>
          </div>
        )}

        {/* How it works */}
        {tests.length === 0 && !showNewTest && (
          <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
            <svg className="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Test Your Email Placement</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
              Send a test campaign to seed mailboxes across Gmail, Outlook, Yahoo, and iCloud. Then report where each email landed - Primary, Promotions, or Spam - to identify deliverability issues before sending to real recipients.
            </p>
            <div className="mt-6 grid gap-4 text-left sm:grid-cols-3">
              <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-600 dark:bg-violet-900/50">1</div>
                <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Compose</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Write your email subject and body, select seed accounts to test.</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-600 dark:bg-violet-900/50">2</div>
                <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Send</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Test emails are sent to each seed mailbox through your real sending infrastructure.</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-600 dark:bg-violet-900/50">3</div>
                <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Report</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Check each seed inbox and report where the email landed. See your placement results at a glance.</p>
              </div>
            </div>
          </div>
        )}

        {/* Test list */}
        {tests.length > 0 && (
          <div className="space-y-4">
            {tests.map((test) => {
              const summary = getPlacementSummary(test.results);
              const isExpanded = expandedTestId === test._id;
              const total = test.results.length;
              const reported = test.results.filter((r) => r.reportedAt).length;

              return (
                <div key={test._id} className="rounded-2xl border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800">
                  {/* Test header */}
                  <button
                    onClick={() => setExpandedTestId(isExpanded ? null : test._id)}
                    className="flex w-full items-center justify-between px-6 py-4 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="truncate font-semibold text-gray-900 dark:text-white">{test.subject}</h3>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          test.status === "completed" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
                          test.status === "waiting" ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                          test.status === "sending" ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                          test.status === "failed" ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                          "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                        }`}>
                          {test.status === "waiting" ? `${reported}/${total} reported` : test.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(test.createdAt).toLocaleString()} &middot; {total} seed{total !== 1 ? "s" : ""}
                      </p>
                    </div>
                    {/* Mini placement summary */}
                    <div className="ml-4 flex items-center gap-2">
                      {summary.inbox ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{summary.inbox} inbox</span> : null}
                      {summary.promotions ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{summary.promotions} promo</span> : null}
                      {summary.spam ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">{summary.spam} spam</span> : null}
                      <svg className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded results */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-gray-700">
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {test.results.map((result) => (
                          <div key={result._id} className="flex items-center justify-between px-6 py-4">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{result.provider}</p>
                              <p className="truncate text-xs text-gray-500 dark:text-gray-400">{result.seedEmail}</p>
                            </div>

                            {result.placement ? (
                              <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${PLACEMENT_CONFIG[result.placement].bg}`}>
                                <svg className={`h-4 w-4 ${PLACEMENT_CONFIG[result.placement].color}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d={PLACEMENT_CONFIG[result.placement].icon} />
                                </svg>
                                <span className={`text-xs font-medium ${PLACEMENT_CONFIG[result.placement].color}`}>
                                  {PLACEMENT_CONFIG[result.placement].label}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                {(["inbox", "promotions", "spam", "not_received"] as Placement[]).map((p) => (
                                  <button
                                    key={p}
                                    onClick={() => handleReport(test._id, result.seedEmail, p)}
                                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-gray-300 dark:hover:border-gray-500 ${
                                      p === "inbox" ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300" :
                                      p === "promotions" ? "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300" :
                                      p === "spam" ? "border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300" :
                                      "border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400"
                                    }`}
                                    title={PLACEMENT_CONFIG[p].label}
                                  >
                                    {p === "inbox" ? "Inbox" : p === "promotions" ? "Promo" : p === "spam" ? "Spam" : "Missing"}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
