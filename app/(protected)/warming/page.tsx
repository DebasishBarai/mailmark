"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const RAMP_SCHEDULE = [
  { days: "1–3", limit: 5 },
  { days: "4–7", limit: 15 },
  { days: "8–14", limit: 40 },
  { days: "15–21", limit: 100 },
  { days: "22–28", limit: 250 },
];

export default function WarmingPage() {
  const schedules = useQuery(api.warmingSchedules.listForCurrentUser) ?? [];
  const domains = useQuery(api.domains.listForCurrentUser) ?? [];
  const startWarming = useMutation(api.warmingSchedules.start);
  const pauseWarming = useMutation(api.warmingSchedules.pause);
  const resumeWarming = useMutation(api.warmingSchedules.resume);

  const [selectedDomain, setSelectedDomain] = useState<Id<"domains"> | "">("");
  const [selectedMailbox, setSelectedMailbox] = useState<Id<"mailboxes"> | "">("");
  const [starting, setStarting] = useState(false);

  const verifiedDomains = domains.filter((d) => d.verified);

  // Get mailboxes for selected domain
  const mailboxes = useQuery(
    api.mailboxes.listByDomain,
    selectedDomain ? { domainId: selectedDomain as Id<"domains"> } : "skip"
  ) ?? [];

  const handleStart = async () => {
    if (!selectedDomain || !selectedMailbox) return;
    setStarting(true);
    try {
      await startWarming({
        domainId: selectedDomain as Id<"domains">,
        mailboxId: selectedMailbox as Id<"mailboxes">,
      });
      setSelectedDomain("");
      setSelectedMailbox("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start warming");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-900 md:p-10">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Warming</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Gradually increase sending volume on new domains so inbox providers learn to trust them.
          </p>
        </div>

        {/* Ramp schedule reference */}
        <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            28-Day Warming Ramp
          </h2>
          <div className="mt-4 grid grid-cols-5 gap-3">
            {RAMP_SCHEDULE.map((step) => (
              <div
                key={step.days}
                className="rounded-xl bg-violet-50 p-3 text-center dark:bg-violet-900/20"
              >
                <p className="text-xs font-medium text-violet-600 dark:text-violet-400">
                  Days {step.days}
                </p>
                <p className="mt-1 text-lg font-bold text-violet-700 dark:text-violet-300">
                  {step.limit}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">emails/day</p>
              </div>
            ))}
          </div>
        </div>

        {/* Start new warming */}
        <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Start New Warming Schedule
          </h2>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div className="min-w-[200px] flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Domain
              </label>
              <select
                value={selectedDomain}
                onChange={(e) => {
                  setSelectedDomain(e.target.value as Id<"domains">);
                  setSelectedMailbox("");
                }}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              >
                <option value="">Select a verified domain</option>
                {verifiedDomains.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.domain}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Mailbox
              </label>
              <select
                value={selectedMailbox}
                onChange={(e) => setSelectedMailbox(e.target.value as Id<"mailboxes">)}
                disabled={!selectedDomain}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              >
                <option value="">Select a mailbox</option>
                {mailboxes.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.fullAddress}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleStart}
              disabled={!selectedDomain || !selectedMailbox || starting}
              className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
            >
              {starting ? "Starting..." : "Start Warming"}
            </button>
          </div>
        </div>

        {/* Active schedules */}
        <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Warming Schedules
            </h2>
          </div>

          {schedules.length === 0 ? (
            <div className="px-6 py-12 text-center">
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
                  d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"
                />
              </svg>
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                No warming schedules yet. Start one above to improve your domain reputation.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {schedules.map((schedule) => {
                const progress = Math.round(
                  (schedule.currentDay / schedule.totalDays) * 100
                );
                return (
                  <div key={schedule._id} className="px-6 py-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {schedule.domainName}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {schedule.mailboxAddress}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                            schedule.status === "active"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : schedule.status === "paused"
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              schedule.status === "active"
                                ? "bg-emerald-500"
                                : schedule.status === "paused"
                                  ? "bg-amber-500"
                                  : "bg-gray-400"
                            }`}
                          />
                          {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                        </span>
                        {schedule.status === "active" && (
                          <button
                            onClick={() => pauseWarming({ scheduleId: schedule._id })}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            Pause
                          </button>
                        )}
                        {schedule.status === "paused" && (
                          <button
                            onClick={() => resumeWarming({ scheduleId: schedule._id })}
                            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
                          >
                            Resume
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>
                          Day {schedule.currentDay} of {schedule.totalDays}
                        </span>
                        <span>
                          {schedule.sentToday} / {schedule.dailyLimit} sent today
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                        <div
                          className="h-full rounded-full bg-violet-500 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
                        {progress}% complete
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
