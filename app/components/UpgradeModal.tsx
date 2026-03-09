"use client";

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

const plans = [
  {
    key: "starter" as const,
    name: "Starter",
    price: "$9",
    features: ["1,000 emails / month", "1 domain", "3 mailboxes", "5 GB storage"],
  },
  {
    key: "pro" as const,
    name: "Pro",
    price: "$29",
    features: ["25,000 emails / month", "5 domains", "Unlimited mailboxes", "Campaigns & analytics"],
    highlighted: true,
  },
  {
    key: "business" as const,
    name: "Business",
    price: "$99",
    features: ["100,000 emails / month", "Unlimited domains", "Advanced campaigns", "Dedicated support"],
  },
];

export default function UpgradeModal() {
  const subscribe = useMutation(api.subscriptions.subscribe);

  async function handleSelect(plan: "starter" | "pro" | "business") {
    await subscribe({ plan });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-3xl rounded-2xl bg-white p-8 shadow-2xl dark:bg-gray-800">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Your free trial has ended
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Choose a plan to continue using RemindMe. All your data is safe and waiting.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
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
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  /mo
                </span>
              </div>
              <ul className="mt-4 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
                  >
                    <svg
                      className="h-4 w-4 shrink-0 text-violet-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
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
                className={`mt-5 w-full rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                  plan.highlighted
                    ? "bg-violet-600 text-white hover:bg-violet-700"
                    : "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                }`}
              >
                Choose {plan.name}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
