const features = [
  {
    color: "bg-aquamarine",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
    title: "Multi-Domain Management",
    description: "Every product's domain in one place. Add acme.com, yourco.com, and eight more, each verified and ready to send. No more hopping between accounts.",
  },
  {
    color: "bg-vivid-yellow",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
    title: "Unlimited Mailboxes",
    description: "Spin up founder@, support@, and updates@ on any domain. Every product's inbox lives under one login instead of a dozen separate mail accounts.",
  },
  {
    color: "bg-coral",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: "Campaigns with Mail Merge",
    description: "Send \"v2 is live\" to your whole user base. Mail merge gives each person their own email, so nobody sees who else got it. No spammy BCC blast.",
  },
  {
    color: "bg-pale-violet",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
    title: "REST API + npm SDK",
    description: "Send transactional and campaign email straight from your apps. Run npm i mailmark-sdk or hit the REST API. Welcome emails and receipts, on autopilot.",
  },
  {
    color: "bg-lavender-rose",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
      </svg>
    ),
    title: "28-Day Inbox Warming",
    description: "Warm up new mailboxes with real engagement over 28 days so Gmail and Outlook trust your product emails from the very first send.",
  },
  {
    color: "bg-aquamarine",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: "Deliverability Monitoring",
    description: "Continuous SPF, DKIM, DMARC, and blacklist checks across every domain, with alerts before a problem quietly starts costing you signups.",
  },
  {
    color: "bg-vivid-yellow",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: "Analytics Across Products",
    description: "Opens, clicks, replies, and bounces in real time, broken down per campaign and per domain so you know how each product's email is doing.",
  },
  {
    color: "bg-coral",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
      </svg>
    ),
    title: "Automated Sequences",
    description: "Onboarding drips and multi-step follow-ups that send on their own. Set them up once in the dashboard or fire them programmatically from code.",
  },
  {
    color: "bg-pale-violet",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    title: "Sales Outreach, Too",
    description: "Doing cold outreach alongside your products? List verification, seed-inbox placement testing, and per-mailbox sending are built in for that as well.",
  },
];

export default function Features() {
  return (
    <section id="features" className="border-b-2 border-black bg-white px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <span className="mb-4 inline-block rounded-full border-2 border-black bg-aquamarine px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-black">
            One platform, not five
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-black md:text-4xl">
            Everything a multi-product founder needs
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-black/70">
            Domains, mailboxes, campaigns, deliverability, and a send API. All
            the pieces you used to wire together yourself, in one dashboard.
          </p>
        </div>
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border-2 border-black bg-white p-7 shadow-[4px_4px_0px_#000] transition-all hover:-translate-y-1 hover:shadow-[7px_7px_0px_#000]"
            >
              <div
                className={`mb-4 inline-flex rounded-lg border-2 border-black ${feature.color} p-3 text-black`}
              >
                {feature.icon}
              </div>
              <h3 className="text-lg font-extrabold text-black">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-black/70">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
