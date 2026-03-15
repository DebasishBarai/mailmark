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
  starter: "$10/mo",
  pro: "$25/mo",
  business: "$75/mo",
};

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
  const subStatus = status?.subscription?.status;
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
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    {PLAN_LABELS[plan] ?? plan}
                  </span>
                  <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Active
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {PLAN_PRICES[plan] ?? ""} · billed monthly
                </p>
              </div>
            </div>
          ) : trialExpired ? (
            <div>
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                Your trial has expired. Choose a plan below to continue.
              </p>
            </div>
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

      {/* Plans */}
      {!isActive && (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-700/50">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Upgrade your plan</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3">
            {(["starter", "pro", "business"] as const).map((p) => (
              <div
                key={p}
                className={`flex flex-col rounded-xl border p-5 ${
                  p === "pro"
                    ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30"
                    : "border-gray-200 dark:border-gray-700"
                }`}
              >
                {p === "pro" && (
                  <span className="mb-3 self-start rounded-full bg-violet-600 px-3 py-0.5 text-xs font-semibold text-white">
                    Most popular
                  </span>
                )}
                <p className="text-base font-semibold text-gray-900 dark:text-white">{PLAN_LABELS[p]}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{PLAN_PRICES[p]}</p>
                <button
                  onClick={() => handleUpgrade(p)}
                  disabled={loading !== null}
                  className={`mt-4 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                    p === "pro"
                      ? "bg-violet-600 text-white hover:bg-violet-700"
                      : "border border-violet-600 text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-900/20"
                  }`}
                >
                  {loading === p ? "Redirecting..." : `Choose ${PLAN_LABELS[p]}`}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
