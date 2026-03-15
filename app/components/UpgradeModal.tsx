"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

const plans = [
  {
    key: "starter" as const,
    name: "Starter",
    price: "$10",
    features: ["1,000 emails / month", "1 domain", "3 mailboxes", "Full email UI", "Email campaigns", "Campaign analytics"],
  },
  {
    key: "pro" as const,
    name: "Pro",
    price: "$25",
    features: ["25,000 emails / month", "5 domains", "Unlimited mailboxes", "Full email UI", "Email campaigns", "Campaign analytics"],
    highlighted: true,
  },
  {
    key: "business" as const,
    name: "Business",
    price: "$75",
    features: ["100,000 emails / month", "Unlimited domains", "Full email UI", "Email campaigns", "Campaign analytics", "Dedicated support"],
  },
];

export default function UpgradeModal() {
  const createCheckoutSession = useAction(api.subscriptions.createCheckoutSession);
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
        className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl dark:bg-gray-800 animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-dialog-title"
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-4 text-center border-b border-gray-100 dark:border-gray-700">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40">
            <svg className="h-7 w-7 text-violet-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 id="upgrade-dialog-title" className="text-2xl font-bold text-gray-900 dark:text-white">
            Your free trial has ended
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Choose a plan to continue using Mailmark. All your data is safe and waiting.
          </p>
        </div>

        {/* Plans */}
        <div className="px-8 py-6">
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
                  <span className="text-sm text-gray-500 dark:text-gray:400">/mo</span>
                </div>
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
                  ) : (
                    `Choose ${plan.name}`
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-6 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Secure checkout via Polar &middot; Cancel anytime &middot; All prices in USD
          </p>
        </div>
      </div>
    </div>
  );
}
