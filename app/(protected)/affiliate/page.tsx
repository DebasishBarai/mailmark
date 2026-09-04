"use client";

import { useCallback, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import LoadMoreSentinel from "../../components/LoadMoreSentinel";

const PAGE_SIZE = 50;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== "undefined" ? window.location.origin : "");

// ─── Apply Form ───────────────────────────────────────────────────────────────

function ApplyForm() {
  const apply = useMutation(api.affiliates.apply);
  const [form, setForm] = useState({ payoutEmail: "", website: "", audienceDescription: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apply({
        payoutEmail: form.payoutEmail,
        website: form.website || undefined,
        audienceDescription: form.audienceDescription,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40">
          <svg className="h-6 w-6 text-violet-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Apply to become an affiliate</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Earn 30% recurring commission on every referral. We review applications within 48 hours.
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Payout email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={form.payoutEmail}
              onChange={(e) => setForm({ ...form, payoutEmail: e.target.value })}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">We&apos;ll send commissions to this address via PayPal or bank transfer.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Website / social profile
            </label>
            <input
              type="url"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://yourblog.com"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Tell us about your audience <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={form.audienceDescription}
              onChange={(e) => setForm({ ...form, audienceDescription: e.target.value })}
              placeholder="e.g. I run a newsletter about SaaS tools with 5,000 subscribers..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Submitting..." : "Submit application"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    canceled: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
    paid: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}

// ─── Copy Button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      className="ml-2 rounded-md bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-800/40"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function AffiliateDashboard({ affiliate }: { affiliate: NonNullable<ReturnType<typeof useQuery<typeof api.affiliates.getMyAffiliate>>> }) {
  // Old: read every referral just to fill a table and two stat tiles.
  // const referrals = useQuery(api.affiliates.getMyReferrals) ?? [];
  const {
    results: referrals,
    status: referralStatus,
    loadMore,
  } = usePaginatedQuery(
    api.affiliates.getMyReferralsPage,
    {},
    { initialNumItems: PAGE_SIZE }
  );
  const onLoadMore = useCallback(() => loadMore(PAGE_SIZE), [loadMore]);
  const payouts = useQuery(api.affiliates.getMyPayouts) ?? [];

  const referralLink = `${APP_URL}/?ref=${affiliate!.code}`;
  // From the affiliate row, not the loaded page: the table is paginated now,
  // and these two tiles are meant to be totals.
  const totalReferrals = affiliate!.totalReferrals ?? 0;
  const activeReferrals = affiliate!.activeReferrals ?? 0;
  const unpaidCents = affiliate!.totalEarnedCents - affiliate!.totalPaidCents;

  return (
    <div className="space-y-8">
      {/* Status banner for pending/rejected */}
      {affiliate!.status === "pending" && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-5 py-4 dark:border-yellow-800 dark:bg-yellow-950/30">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">
            Your application is under review. We&apos;ll approve it within 48 hours and email you at <strong>{affiliate!.payoutEmail}</strong>.
          </p>
        </div>
      )}
      {affiliate!.status === "rejected" && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 dark:border-red-800 dark:bg-red-950/30">
          <p className="text-sm font-medium text-red-800 dark:text-red-400">
            Your application was not approved. Contact us if you have questions.
          </p>
        </div>
      )}

      {/* Referral link - only shown when approved */}
      {affiliate!.status === "approved" && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Your referral link</p>
          <div className="mt-2 flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-600 dark:bg-gray-900">
            <span className="flex-1 truncate text-sm text-gray-700 dark:text-gray-200">{referralLink}</span>
            <CopyButton text={referralLink} />
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Referral cookie lasts 90 days. Minimum payout: $50. Processed on the 15th of each month.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total referrals", value: totalReferrals },
          { label: "Active subscribers", value: activeReferrals },
          { label: "Total earned", value: `$${(affiliate!.totalEarnedCents / 100).toFixed(2)}` },
          { label: "Pending payout", value: `$${(unpaidCents / 100).toFixed(2)}` },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Referrals table */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Referrals</h3>
        </div>
        {referralStatus === "LoadingFirstPage" ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Loading...
          </p>
        ) : referrals.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No referrals yet. Share your link to get started.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <th className="px-5 py-3">Referred</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Commission</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r._id} className="border-b border-gray-50 last:border-0 dark:border-gray-700/50">
                  <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{r.referredUserId.slice(-8)}</td>
                  <td className="px-5 py-3 capitalize text-gray-700 dark:text-gray-300">{r.plan ?? "-"}</td>
                  <td className="px-5 py-3 font-medium text-violet-700 dark:text-violet-400">
                    {r.commissionCents > 0 ? `$${(r.commissionCents / 100).toFixed(2)}/mo` : "-"}
                  </td>
                  <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <LoadMoreSentinel onLoadMore={onLoadMore} status={referralStatus} />
      </div>

      {/* Payouts table */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Payout history</h3>
        </div>
        {payouts.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No payouts yet. Minimum threshold is $50.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Processed</th>
                <th className="px-5 py-3">Note</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p._id} className="border-b border-gray-50 last:border-0 dark:border-gray-700/50">
                  <td className="px-5 py-3 font-semibold text-gray-900 dark:text-white">${(p.amountCents / 100).toFixed(2)}</td>
                  <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                    {p.processedAt ? new Date(p.processedAt).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{p.note ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AffiliatePage() {
  const affiliate = useQuery(api.affiliates.getMyAffiliate);

  // Loading
  if (affiliate === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Affiliate Program</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Earn 30% recurring commission for every customer you refer.
        </p>
      </div>

      {affiliate === null ? (
        <ApplyForm />
      ) : (
        <AffiliateDashboard affiliate={affiliate} />
      )}
    </div>
  );
}
