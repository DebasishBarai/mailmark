import type { Metadata } from "next";
import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  title: "System Status - DevMail",
  description: "Real-time status of all DevMail services and infrastructure components.",
};

type Status = "operational" | "degraded" | "outage";

const components: { name: string; description: string; status: Status }[] = [
  { name: "Email Sending (Outbound)", description: "SMTP and API-based email delivery via AWS SES", status: "operational" },
  { name: "Email Receiving (Inbound)", description: "Inbound MX routing and mailbox delivery", status: "operational" },
  { name: "Web Dashboard", description: "Dashboard UI at app.devmail.app", status: "operational" },
  { name: "API", description: "REST API at api.devmail.app", status: "operational" },
  { name: "DNS Verification", description: "Domain verification and DNS record checking", status: "operational" },
  { name: "Campaign Engine", description: "Bulk email sending and scheduling", status: "operational" },
  { name: "Authentication (Clerk)", description: "Sign-in, sign-up, and session management", status: "operational" },
  { name: "Database (Convex)", description: "Real-time database and backend functions", status: "operational" },
  { name: "File Storage (S3)", description: "Email attachment storage", status: "operational" },
  { name: "Webhooks & Notifications", description: "Bounce, complaint, and delivery webhooks via AWS SNS", status: "operational" },
];

const uptime = [
  { service: "Email Sending", uptime: "99.98%", period: "Last 90 days" },
  { service: "Web Dashboard", uptime: "99.97%", period: "Last 90 days" },
  { service: "API", uptime: "99.99%", period: "Last 90 days" },
  { service: "Email Receiving", uptime: "99.95%", period: "Last 90 days" },
];

const statusConfig: Record<Status, { label: string; color: string; dot: string; bg: string }> = {
  operational: {
    label: "Operational",
    color: "text-emerald-700",
    dot: "bg-emerald-500",
    bg: "bg-emerald-50 border-emerald-100",
  },
  degraded: {
    label: "Degraded performance",
    color: "text-amber-700",
    dot: "bg-amber-400",
    bg: "bg-amber-50 border-amber-100",
  },
  outage: {
    label: "Major outage",
    color: "text-red-700",
    dot: "bg-red-500",
    bg: "bg-red-50 border-red-100",
  },
};

const allOperational = components.every((c) => c.status === "operational");

export default function StatusPage() {
  return (
    <main>
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-b from-violet-50 to-white px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-violet-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700">
            System Status
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            All systems
          </h1>

          {/* Overall status banner */}
          {allOperational ? (
            <div className="mx-auto mt-6 inline-flex items-center gap-2.5 rounded-full bg-emerald-100 px-6 py-3">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
              </span>
              <span className="font-semibold text-emerald-800">All systems operational</span>
            </div>
          ) : (
            <div className="mx-auto mt-6 inline-flex items-center gap-2.5 rounded-full bg-amber-100 px-6 py-3">
              <span className="h-3 w-3 rounded-full bg-amber-500" />
              <span className="font-semibold text-amber-800">Some systems affected</span>
            </div>
          )}

          <p className="mt-4 text-sm text-gray-400">
            Last checked: {new Date().toUTCString()}
          </p>
        </div>
      </section>

      {/* Components */}
      <section className="bg-white px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-xl font-bold text-gray-900">Service components</h2>
          <div className="mt-6 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100">
            {components.map((c) => {
              const cfg = statusConfig[c.status];
              return (
                <div key={c.name} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <p className="text-sm text-gray-500">{c.description}</p>
                  </div>
                  <div className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 ${cfg.bg}`}>
                    <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                    <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Uptime */}
      <section className="bg-gray-50 px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-xl font-bold text-gray-900">Uptime</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {uptime.map((u) => (
              <div key={u.service} className="rounded-2xl border border-gray-100 bg-white p-5 text-center">
                <p className="text-3xl font-extrabold text-emerald-600">{u.uptime}</p>
                <p className="mt-1 text-sm font-medium text-gray-700">{u.service}</p>
                <p className="mt-0.5 text-xs text-gray-400">{u.period}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Incident history */}
      <section className="bg-white px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-xl font-bold text-gray-900">Incident history</h2>
          <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 px-6 py-10 text-center">
            <svg className="mx-auto h-10 w-10 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-3 font-semibold text-gray-700">No incidents in the last 90 days</p>
            <p className="mt-1 text-sm text-gray-500">
              We will post updates here whenever there are service disruptions.
            </p>
          </div>
        </div>
      </section>

      {/* Subscribe */}
      <section className="bg-gray-50 px-6 py-12">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-lg font-bold text-gray-900">Stay informed</h2>
          <p className="mt-2 text-sm text-gray-600">
            Get notified by email whenever a new incident is posted or resolved.
          </p>
          <form className="mt-5 flex gap-3" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder="you@example.com"
              className="flex-1 rounded-full border border-gray-200 px-5 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
            <button
              type="submit"
              className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
            >
              Subscribe
            </button>
          </form>
        </div>
      </section>

      <Footer />
    </main>
  );
}
