import type { Metadata } from "next";
import Link from "next/link";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

export const metadata: Metadata = {
  title: "Getting Started - Mailmark Docs",
  description: "Set up Mailmark in minutes — create your account, verify a domain, and send your first email.",
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-gray-100 py-12 dark:border-gray-800">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        {children}
      </div>
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl bg-gray-900 px-5 py-4 text-sm text-gray-100 dark:bg-gray-950">
      <code>{children}</code>
    </pre>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-400">
        {n}
      </div>
      <div>
        <p className="font-semibold text-gray-900 dark:text-white">{title}</p>
        <div className="mt-1 text-gray-600 dark:text-gray-300">{children}</div>
      </div>
    </div>
  );
}

const NAV = [
  { id: "quick-start", label: "Quick-start guide" },
  { id: "creating-account", label: "Creating your account" },
  { id: "adding-domain", label: "Adding your first domain" },
  { id: "sending-email", label: "Sending your first email" },
];

export default function GettingStartedPage() {
  return (
    <main className="bg-white dark:bg-gray-900">
      <Header />

      <div className="mx-auto max-w-7xl px-6 py-12 lg:flex lg:gap-12">
        {/* Sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-24 space-y-1">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">On this page</p>
            {NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-violet-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-violet-400"
              >
                {item.label}
              </a>
            ))}
          </div>
        </aside>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Breadcrumb */}
          <nav className="mb-6 flex items-center gap-2 text-sm text-gray-400">
            <Link href="/docs" className="hover:text-violet-600">Docs</Link>
            <span>/</span>
            <span className="text-gray-700 dark:text-gray-200">Getting Started</span>
          </nav>

          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Getting Started
          </h1>
          <p className="mt-3 text-lg text-gray-600 dark:text-gray-300">
            Go from zero to sending emails with Mailmark in under 10 minutes.
          </p>

          <Section id="quick-start" title="Quick-start guide">
            <p>Follow these four steps to get up and running:</p>
            <div className="mt-6 space-y-6">
              <Step n={1} title="Create a Mailmark account">
                Sign up at <Link href="/sign-up" className="text-violet-600 hover:underline">mailmark.io/sign-up</Link>. No credit card required to start.
              </Step>
              <Step n={2} title="Add and verify your domain">
                Go to <strong>Dashboard → Domains</strong> and click <strong>Add domain</strong>. Enter your domain name and follow the DNS instructions to verify ownership.
              </Step>
              <Step n={3} title="Create a mailbox">
                Once your domain is verified, create a mailbox under <strong>Dashboard → Mailboxes</strong>. For example, <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">hello@yourdomain.com</code>.
              </Step>
              <Step n={4} title="Send your first email">
                Use the dashboard composer, the REST API, or the <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">mailmark</code> npm package to send.
              </Step>
            </div>
          </Section>

          <Section id="creating-account" title="Creating your account">
            <p>
              Visit <Link href="/sign-up" className="text-violet-600 hover:underline">mailmark.io/sign-up</Link> and sign up with your email or Google account via Clerk.
              After signing in you will land on the dashboard. Your account starts on the free plan with support for one domain and up to 200 emails per day.
            </p>
            <p>
              You can upgrade to a paid plan at any time from <strong>Dashboard → Settings → Billing</strong>.
            </p>
          </Section>

          <Section id="adding-domain" title="Adding your first domain">
            <p>
              You must own and control the domain you want to send from. Mailmark does not provide domain registration.
            </p>
            <div className="mt-4 space-y-3">
              <p><strong>1.</strong> Go to <strong>Dashboard → Domains</strong> and click <strong>Add domain</strong>.</p>
              <p><strong>2.</strong> Enter your domain (e.g. <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">acme.com</code>) and click <strong>Continue</strong>.</p>
              <p><strong>3.</strong> Mailmark will show you DNS records to add to your domain registrar. These include TXT records for SPF and DKIM. Add them all.</p>
              <p><strong>4.</strong> Click <strong>Verify</strong>. DNS propagation can take up to 48 hours but usually completes within minutes.</p>
            </div>
            <p>
              Once verified the domain status changes to <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">Active</span>.
              See <Link href="/docs/domain-setup" className="text-violet-600 hover:underline">Domain Setup</Link> for the full DNS reference.
            </p>
          </Section>

          <Section id="sending-email" title="Sending your first email">
            <p>Once your domain is verified and a mailbox exists, you can send immediately.</p>

            <p className="mt-4 font-medium text-gray-900 dark:text-white">Using the npm SDK</p>
            <Code>{`npm install mailmark
# or
bun add mailmark`}</Code>

            <Code>{`import { Mailmark } from 'mailmark';

const client = new Mailmark('dm_live_your_api_key');

await client.send({
  from: 'hello@yourdomain.com',
  to: 'recipient@example.com',
  subject: 'Hello from Mailmark!',
  html: '<h1>It works!</h1>',
});`}</Code>

            <p className="mt-4 font-medium text-gray-900 dark:text-white">Using cURL</p>
            <Code>{`curl -X POST https://harmless-armadillo-386.convex.site/v1/send \\
  -H "Authorization: Bearer dm_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "hello@yourdomain.com",
    "to": ["recipient@example.com"],
    "subject": "Hello from Mailmark!",
    "html": "<h1>It works!</h1>"
  }'`}</Code>

            <p>
              Your API key is available in <strong>Dashboard → Developer</strong>.
              See the <Link href="/docs/api" className="text-violet-600 hover:underline">API Reference</Link> for the full endpoint list.
            </p>
          </Section>

          {/* Next steps */}
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {[
              { href: "/docs/domain-setup", title: "Domain Setup", desc: "Configure DNS, SPF, DKIM, and DMARC." },
              { href: "/docs/mailboxes", title: "Mailboxes", desc: "Create and manage mailboxes on your domain." },
              { href: "/docs/email-campaigns", title: "Email Campaigns", desc: "Send bulk campaign emails with personalization." },
              { href: "/docs/api", title: "API Reference", desc: "Full REST API reference with live playground." },
            ].map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="rounded-xl border border-gray-100 p-5 transition hover:border-violet-200 hover:shadow-sm dark:border-gray-700 dark:hover:border-violet-700"
              >
                <p className="font-semibold text-gray-900 dark:text-white">{card.title} →</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{card.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
