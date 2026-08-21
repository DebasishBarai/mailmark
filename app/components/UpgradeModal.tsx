"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { useClerk } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";

const plans = [
  {
    key: "starter" as const,
    name: "Starter",
    price: "$10",
    features: ["1,000 emails / month", "1 domain", "3 mailboxes", "Full email UI", "Email campaigns", "Campaign analytics"],
    // Starter and Pro carry the 7 day Polar trial, Business does not (see Pricing.tsx)
    hasTrial: true,
  },
  {
    key: "pro" as const,
    name: "Pro",
    price: "$50",
    features: ["25,000 emails / month", "5 domains", "Unlimited mailboxes", "Full email UI", "Email campaigns", "Campaign analytics"],
    hasTrial: true,
    highlighted: true,
  },
  {
    key: "business" as const,
    name: "Business",
    price: "$100",
    features: ["100,000 emails / month", "Unlimited domains", "Full email UI", "Email campaigns", "Campaign analytics", "Dedicated support"],
    hasTrial: false,
  },
];

// Why the paywall is up. A brand new account never had in-app trial time
// (TRIAL_DURATION_MS is 0), so telling it that a trial "has ended" is wrong.
export type UpgradeReason = "new_user" | "trial_ended" | "subscription_ended";

const COPY: Record<UpgradeReason, { title: string; subtitle: string }> = {
  new_user: {
    title: "Choose a plan to get started",
    subtitle:
      "Starter and Pro include a 7-day free trial. Nothing is charged until day 8, and cancelling before then costs you nothing.",
  },
  trial_ended: {
    title: "Your free trial has ended",
    subtitle: "Choose a plan to continue using Mailmark. All your data is safe and waiting.",
  },
  subscription_ended: {
    title: "Your subscription has ended",
    subtitle: "Choose a plan to continue using Mailmark. All your data is safe and waiting.",
  },
};

// Old signature, before the modal knew why it was being shown:
// export default function UpgradeModal() {
export default function UpgradeModal({ reason = "trial_ended" }: { reason?: UpgradeReason }) {
  const copy = COPY[reason];
  const isNewUser = reason === "new_user";
  const createCheckoutSession = useAction(api.subscriptions.createCheckoutSession);
  const { signOut } = useClerk();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(plan: "starter" | "pro" | "business") {
    setLoading(plan);
    setError(null);
    try {
      const { url } = await createCheckoutSession({ plan });
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="flex w-full max-w-3xl max-h-[calc(100vh-2rem)] flex-col rounded-2xl bg-white shadow-2xl dark:bg-gray-800 animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-dialog-title"
      >
        {/* Header */}
        <div className="shrink-0 px-6 pt-6 pb-4 text-center border-b border-gray-100 dark:border-gray-700 md:px-8 md:pt-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40">
            <svg className="h-7 w-7 text-violet-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              {isNewUser ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.63 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
          </div>
          <h2 id="upgrade-dialog-title" className="text-2xl font-bold text-gray-900 dark:text-white">
            {/* Old hardcoded heading: Your free trial has ended */}
            {copy.title}
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {copy.subtitle}
          </p>
        </div>

        {/* Plans */}
        <div className="overflow-y-auto px-6 py-6 md:px-8">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.key}
                className={`relative flex flex-col rounded-xl border p-5 transition-shadow hover:shadow-md ${
                  plan.highlighted
                    ? "border-violet-500 bg-violet-50 ring-2 ring-violet-500 dark:bg-violet-950/30"
                    : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Popular
                  </span>
                )}
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {plan.name}
                </h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">
                    {plan.price}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">/mo</span>
                </div>
                {isNewUser && plan.hasTrial && (
                  <p className="mt-1 text-xs font-medium text-violet-600 dark:text-violet-400">
                    7-day free trial included
                  </p>
                )}
                <ul className="mt-4 flex-1 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <svg className="h-4 w-4 shrink-0 text-violet-500" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSelect(plan.key)}
                  disabled={loading !== null}
                  className={`mt-5 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    plan.highlighted
                      ? "bg-violet-600 text-white hover:bg-violet-700"
                      : "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                  }`}
                >
                  {loading === plan.key ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Redirecting...
                    </>
                  ) : isNewUser && plan.hasTrial ? (
                    // Old: always `Choose ${plan.name}`
                    "Start free trial"
                  ) : (
                    `Choose ${plan.name}`
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 pb-6 text-center md:px-8">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Secure checkout via Polar &middot; Cancel anytime &middot; All prices in USD
          </p>
          <button
            onClick={() => signOut({ redirectUrl: "/" })}
            className="mt-3 text-sm text-gray-500 underline hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
