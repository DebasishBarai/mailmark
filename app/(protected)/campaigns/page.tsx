"use client";

import { useState } from "react";

const campaigns = [
  {
    id: "c1",
    name: "Product Launch - Q1 2026",
    status: "Completed",
    from: "sales@acmecorp.com",
    sent: 2450,
    opened: 1223,
    clicked: 384,
    replied: 89,
    bounced: 12,
    createdAt: "Jan 15, 2026",
  },
  {
    id: "c2",
    name: "Welcome Series",
    status: "Sending",
    from: "info@acmecorp.com",
    sent: 847,
    opened: 356,
    clicked: 98,
    replied: 42,
    bounced: 3,
    createdAt: "Feb 1, 2026",
  },
  {
    id: "c3",
    name: "Re-engagement Flow",
    status: "Draft",
    from: "sales@acmecorp.com",
    sent: 0,
    opened: 0,
    clicked: 0,
    replied: 0,
    bounced: 0,
    createdAt: "Feb 18, 2026",
  },
  {
    id: "c4",
    name: "Monthly Newsletter - February",
    status: "Scheduled",
    from: "info@acmecorp.com",
    sent: 0,
    opened: 0,
    clicked: 0,
    replied: 0,
    bounced: 0,
    createdAt: "Feb 20, 2026",
  },
  {
    id: "c5",
    name: "Customer Feedback Survey",
    status: "Completed",
    from: "support@acmecorp.com",
    sent: 1850,
    opened: 921,
    clicked: 445,
    replied: 156,
    bounced: 8,
    createdAt: "Dec 10, 2025",
  },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Completed: "bg-green-100 text-green-700",
    Sending: "bg-blue-100 text-blue-700",
    Draft: "bg-gray-100 text-gray-600",
    Scheduled: "bg-amber-100 text-amber-700",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || styles.Draft}`}>
      {status}
    </span>
  );
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-sm font-semibold text-gray-900">{value.toLocaleString()}</p>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  );
}

export default function CampaignsPage() {
  const [showNewCampaign, setShowNewCampaign] = useState(false);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create and manage your email campaigns.
          </p>
        </div>
        <button
          onClick={() => setShowNewCampaign(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Campaign
        </button>
      </div>

      {/* Campaign list */}
      <div className="space-y-4">
        {campaigns.map((campaign) => (
          <div
            key={campaign.id}
            className="rounded-xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold text-gray-900">{campaign.name}</h3>
                  <StatusBadge status={campaign.status} />
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                  <span>From: {campaign.from}</span>
                  <span>Created: {campaign.createdAt}</span>
                </div>
              </div>
              <button className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
              </button>
            </div>

            {campaign.sent > 0 && (
              <div className="mt-4 flex gap-6 rounded-lg bg-gray-50 px-6 py-3">
                <StatCell label="Sent" value={campaign.sent} />
                <StatCell label="Opened" value={campaign.opened} />
                <StatCell label="Clicked" value={campaign.clicked} />
                <StatCell label="Replied" value={campaign.replied} />
                <StatCell label="Bounced" value={campaign.bounced} />
                {campaign.sent > 0 && (
                  <div className="text-center">
                    <p className="text-sm font-semibold text-violet-600">
                      {Math.round((campaign.opened / campaign.sent) * 100)}%
                    </p>
                    <p className="text-[10px] text-gray-500">Open Rate</p>
                  </div>
                )}
              </div>
            )}

            {campaign.status === "Draft" && (
              <div className="mt-4">
                <button className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700">
                  Edit & Send
                </button>
              </div>
            )}

            {campaign.status === "Scheduled" && (
              <div className="mt-4 flex items-center gap-2 text-xs text-amber-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Scheduled for Feb 25, 2026 at 9:00 AM
              </div>
            )}
          </div>
        ))}
      </div>

      {/* New campaign modal */}
      {showNewCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900">New Campaign</h2>
            <p className="mt-1 text-sm text-gray-500">
              Set up a new email campaign.
            </p>
            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="campaign-name" className="block text-sm font-medium text-gray-700">
                  Campaign name
                </label>
                <input
                  id="campaign-name"
                  type="text"
                  placeholder="e.g., Product Launch Q2"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>
              <div>
                <label htmlFor="campaign-from" className="block text-sm font-medium text-gray-700">
                  Send from
                </label>
                <select
                  id="campaign-from"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                >
                  <option>sales@acmecorp.com</option>
                  <option>support@acmecorp.com</option>
                  <option>info@acmecorp.com</option>
                  <option>hello@startupxyz.io</option>
                </select>
              </div>
              <div>
                <label htmlFor="campaign-subject" className="block text-sm font-medium text-gray-700">
                  Subject line
                </label>
                <input
                  id="campaign-subject"
                  type="text"
                  placeholder="Hi {firstName}, check this out"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>
              <div>
                <label htmlFor="campaign-body" className="block text-sm font-medium text-gray-700">
                  Message
                </label>
                <textarea
                  id="campaign-body"
                  rows={5}
                  placeholder="Write your campaign email..."
                  className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowNewCampaign(false)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowNewCampaign(false)}
                className="flex-1 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
              >
                Create Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
