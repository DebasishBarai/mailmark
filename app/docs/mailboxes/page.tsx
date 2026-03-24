import type { Metadata } from "next";
import Link from "next/link";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

export const metadata: Metadata = {
  title: "Mailboxes - Mailmark Docs",
  description: "Create and manage mailboxes, aliases, permissions, and IMAP access in Mailmark.",
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

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
      {children}
    </div>
  );
}

const NAV = [
  { id: "creating-mailboxes", label: "Creating mailboxes" },
  { id: "managing-aliases", label: "Managing aliases" },
  { id: "permissions", label: "Team mailbox permissions" },
  { id: "imap", label: "Connecting an email client" },
];

export default function MailboxesPage() {
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
          <nav className="mb-6 flex items-center gap-2 text-sm text-gray-400">
            <Link href="/docs" className="hover:text-violet-600">Docs</Link>
            <span>/</span>
            <span className="text-gray-700 dark:text-gray-200">Mailboxes</span>
          </nav>

          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Mailboxes
          </h1>
          <p className="mt-3 text-lg text-gray-600 dark:text-gray-300">
            Mailboxes are the email addresses on your verified domain. You can create, manage, and send from them via the dashboard or API.
          </p>

          <Section id="creating-mailboxes" title="Creating mailboxes">
            <p>
              A mailbox represents a single email address on your domain, e.g. <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">support@acme.com</code>.
              You must have a verified domain before creating mailboxes.
            </p>

            <p className="font-semibold text-gray-900 dark:text-white">From the dashboard</p>
            <div className="space-y-2">
              <p><strong>1.</strong> Go to <strong>Dashboard → Mailboxes</strong> and click <strong>New mailbox</strong>.</p>
              <p><strong>2.</strong> Enter the local part (e.g. <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">support</code>) and an optional display name.</p>
              <p><strong>3.</strong> Click <strong>Create</strong>. The mailbox is ready to use immediately.</p>
            </div>

            <p className="font-semibold text-gray-900 dark:text-white">Via the API</p>
            <Code>{`import { Mailmark } from 'mailmark-sdk';

const client = new Mailmark('dm_live_your_api_key');

const mailbox = await client.createMailbox({
  address: 'support',       // → support@yourdomain.com
  displayName: 'Support Team',
});

console.log(mailbox.fullAddress); // support@yourdomain.com`}</Code>

            <InfoBox>
              The domain suffix is automatically appended. Pass only the local part (before the @).
            </InfoBox>

            <p className="font-semibold text-gray-900 dark:text-white">Deleting a mailbox</p>
            <p>
              Deleting a mailbox also permanently deletes all emails stored in it. This action cannot be undone.
            </p>
            <Code>{`await client.deleteMailbox('support');
// or use the full address:
await client.deleteMailbox('support@yourdomain.com');`}</Code>
          </Section>

          <Section id="managing-aliases" title="Managing aliases">
            <p>
              Aliases let multiple email addresses deliver to the same mailbox. For example, <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">help@acme.com</code> and <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">contact@acme.com</code> can both route to the <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">support</code> mailbox.
            </p>
            <p>
              To create an alias, go to <strong>Dashboard → Mailboxes → select a mailbox → Aliases → Add alias</strong> and enter the alias address.
              Aliases count towards your domain&apos;s mailbox limit on some plans.
            </p>
            <p>
              Aliases receive mail but cannot be used as sender addresses. To send from a different address, create a separate mailbox.
            </p>
          </Section>

          <Section id="permissions" title="Team mailbox permissions">
            <p>
              By default every mailbox on a domain is accessible to the domain owner. Sender Groups control which mailboxes can send as part of a group, allowing you to segment access without sharing credentials.
            </p>
            <p>
              To grant a team member access to a specific mailbox via the API, create a separate API key scoped to that domain and share only that key. API keys are scoped per domain, so a key cannot access mailboxes on a domain it was not issued for.
            </p>
            <p>
              Team member invites and per-user mailbox permissions are on the roadmap. Follow the changelog for updates.
            </p>
          </Section>

          <Section id="imap" title="Connecting an email client (IMAP)">
            <p>
              Mailmark supports IMAP for reading received email through standard email clients such as Apple Mail, Thunderbird, or Outlook.
            </p>

            <p className="font-semibold text-gray-900 dark:text-white">IMAP settings</p>
            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">Setting</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {[
                    ["Server", "imap.mailmark.dev"],
                    ["Port", "993"],
                    ["Security", "SSL / TLS"],
                    ["Username", "your full email address"],
                    ["Password", "your Mailmark account password"],
                  ].map(([k, v]) => (
                    <tr key={k}>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-900 dark:text-gray-100">{k}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-300">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <InfoBox>
              IMAP access is read-only. Sending always goes through the Mailmark dashboard or API.
            </InfoBox>
          </Section>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {[
              { href: "/docs/email-campaigns", title: "Email Campaigns", desc: "Use mailboxes to run bulk campaign sends." },
              { href: "/docs/api#list-mailboxes", title: "API: Mailboxes", desc: "Full REST API reference for mailbox management." },
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
