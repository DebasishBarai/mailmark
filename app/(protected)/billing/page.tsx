"use client";

import { useQuery, useAction } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

const PLAN_PRICES: Record<string, string> = {
  starter: "$10",
  pro: "$50",
  business: "$100",
};

const plans = [
  {
    key: "starter" as const,
    name: "Starter",
    price: "$10",
    period: "per month",
    description: "Perfect for individuals getting started with custom domain email.",
    features: [
      "1,000 emails / month",
      "1 custom domain",
      "3 mailboxes",
      "Full email UI",
      "Email campaigns",
      "Campaign analytics",
      "Basic support",
    ],
    highlighted: false,
  },
  {
    key: "pro" as const,
    name: "Pro",
    price: "$50",
    period: "per month",
    description: "For growing teams that need more power and campaign tools.",
    features: [
      "25,000 emails / month",
      "5 custom domains",
      "Unlimited mailboxes",
      "Full email UI",
      "Email campaigns",
      "Campaign analytics",
      "Priority support",
    ],
    highlighted: true,
  },
  {
    key: "business" as const,
    name: "Business",
    price: "$100",
    period: "per month",
    description: "Unlimited scale with white-glove onboarding for your whole team.",
    features: [
      "100,000 emails / month",
      "Unlimited domains",
      "Unlimited mailboxes",
      "Full email UI",
      "Email campaigns",
      "Campaign analytics",
      "Dedicated support",
    ],
    highlighted: false,
  },
];

function CheckIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function BillingPage() {
  const status = useQuery(api.subscriptions.currentStatus);
  const createCheckout = useAction(api.subscriptions.createCheckoutSession);
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (plan: "starter" | "pro" | "business") => {
    setLoading(plan);
    try {
      const { url } = await createCheckout({ plan });
      window.location.href = url;
    } catch (err) {
      console.error(err);
      setLoading(null);
    }
  };

  if (status === undefined) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <div className="h-8 w-32 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
        </div>
        <div className="h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-700" />
      </div>
    );
  }

  const plan = status?.subscription?.plan;
  const isActive = status?.hasActiveSubscription;
  const trialEndsAt = status?.trialEndsAt;
  const trialExpired = status?.trialExpired;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Billing</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage your subscription and plan.
        </p>
      </div>

      {/* Current plan card */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-700/50">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Current Plan</h2>
        </div>
        <div className="px-6 py-6">
          {isActive && plan ? (
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                {PLAN_LABELS[plan] ?? plan} - {PLAN_PRICES[plan] ?? ""}/mo
              </span>
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Active
              </span>
            </div>
          ) : trialExpired ? (
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              Your trial has expired. Choose a plan below to continue.
            </p>
          ) : (
            <div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-gray-900 dark:text-white">Free Trial</span>
                <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                  Active
                </span>
              </div>
              {trialEndsAt && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Expires {new Date(trialEndsAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Plans - always shown so users can switch */}
      <div>
        <h2 className="mb-6 text-base font-semibold text-gray-900 dark:text-white">
          {isActive ? "Change Plan" : "Upgrade your plan"}
        </h2>

        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.key}
              className={`relative flex flex-col rounded-2xl p-8 shadow-sm transition-shadow hover:shadow-md ${
                p.highlighted
                  ? "bg-violet-600 text-white ring-2 ring-violet-600"
                  : "border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
              }`}
            >
              {p.highlighted && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-violet-900 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow">
                  Most Popular
                </span>
              )}

              <div>
                <h3 className={`text-lg font-semibold ${p.highlighted ? "text-white" : "text-gray-900 dark:text-white"}`}>
                  {p.name}
                </h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className={`text-4xl font-bold tracking-tight ${p.highlighted ? "text-white" : "text-gray-900 dark:text-white"}`}>
                    {p.price}
                  </span>
                  <span className={`text-sm ${p.highlighted ? "text-violet-200" : "text-gray-500 dark:text-gray-400"}`}>
                    /{p.period}
                  </span>
                </div>
                <p className={`mt-3 text-sm ${p.highlighted ? "text-violet-100" : "text-gray-600 dark:text-gray-400"}`}>
                  {p.description}
                </p>
              </div>

              <ul className="mt-8 flex-1 space-y-3">
                {p.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <span className={p.highlighted ? "text-violet-200" : "text-violet-600"}>
                      <CheckIcon />
                    </span>
                    <span className={`text-sm ${p.highlighted ? "text-violet-100" : "text-gray-600 dark:text-gray-400"}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                {p.highlighted ? (
                  <button
                    onClick={() => handleUpgrade(p.key)}
                    disabled={loading !== null || (isActive && plan === p.key)}
                    className="inline-flex w-full items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-violet-700 shadow transition-all hover:bg-gray-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading === p.key ? "Redirecting..." : isActive && plan === p.key ? "Current plan" : "Choose Pro"}
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(p.key)}
                    disabled={loading !== null || (isActive && plan === p.key)}
                    className="inline-flex w-full items-center justify-center rounded-full border border-violet-600 bg-white px-6 py-3 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-violet-300 dark:hover:bg-violet-900/30"
                  >
                    {loading === p.key ? "Redirecting..." : isActive && plan === p.key ? "Current plan" : `Choose ${p.name}`}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
