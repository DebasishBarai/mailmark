import type { Metadata } from "next";
import Link from "next/link";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

export const metadata: Metadata = {
  title: "Bring your own AWS account (BYO-AWS) - Mailmark Docs",
  description:
    "Connect your own AWS account to Mailmark. Deploy SES, S3, Lambda and SNS inside your account via CloudFormation, and keep full ownership of your email data.",
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

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
      {children}
    </div>
  );
}

function WarnBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
      {children}
    </div>
  );
}

const NAV = [
  { id: "when-to-use", label: "When to use BYO-AWS" },
  { id: "what-gets-provisioned", label: "What gets provisioned" },
  { id: "connect", label: "Step-by-step setup" },
  { id: "ongoing", label: "Ongoing behavior" },
  { id: "disconnect", label: "Disconnecting" },
  { id: "troubleshooting", label: "Troubleshooting" },
];

export default function ByoAwsPage() {
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
            <span className="text-gray-700 dark:text-gray-200">Bring your own AWS account</span>
          </nav>

          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Bring your own AWS account (BYO-AWS)
          </h1>
          <p className="mt-3 text-lg text-gray-600 dark:text-gray-300">
            Deploy the same SES / S3 / Lambda / SNS resources Mailmark uses - but inside your own AWS account, via a CloudFormation Quick-Create stack. Keep full ownership of your email data.
          </p>

          <Section id="when-to-use" title="When to use BYO-AWS">
            <p>
              For most users, the default <strong>Mailmark infrastructure</strong> option is simpler and recommended - Mailmark operates the AWS resources for you and you pay only the Mailmark subscription. Pick BYO-AWS when you need one of:
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li><strong>Data residency</strong> - raw inbound email objects live in your own S3 bucket, in the AWS region you choose.</li>
              <li><strong>Your own SES reputation</strong> - you already have a warmed-up SES account with production access approved.</li>
              <li><strong>Regulatory / compliance</strong> - mailbox contents must be stored in an account you control.</li>
              <li><strong>Consolidated billing</strong> - you prefer SES and S3 costs on your existing AWS bill.</li>
            </ul>
            <p>
              You can mix and match: some domains on Mailmark infrastructure, others on BYO-AWS. The choice is per-domain.
            </p>
          </Section>

          <Section id="what-gets-provisioned" title="What gets provisioned">
            <p>
              The CloudFormation stack creates the following resources in your AWS account:
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li><strong>SES configuration set</strong> + identity registration for your domain.</li>
              <li><strong>S3 bucket</strong> for inbound email storage. Objects remain in your account.</li>
              <li><strong>Lambda forwarder</strong> that picks up new S3 objects and POSTs them to the Mailmark inbound webhook, signed with a per-account shared secret.</li>
              <li><strong>SNS topics</strong> for bounce, complaint, and delivery notifications, pointing to the Mailmark sending webhook.</li>
              <li><strong>IAM role</strong> trusted by Mailmark&apos;s AWS account, with an <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">ExternalId</code> condition. Mailmark uses this role (via <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">STS.AssumeRole</code>) whenever it needs to call SES or S3 on your behalf.</li>
            </ul>
            <InfoBox>
              The <code className="rounded bg-blue-100 px-1 dark:bg-blue-900/40">ExternalId</code> is generated per Mailmark account and baked into the trust policy. It prevents the <a href="https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html" className="underline">confused deputy</a> problem - even if someone else learned your role ARN, they couldn&apos;t assume it without the ExternalId.
            </InfoBox>
          </Section>

          <Section id="connect" title="Step-by-step setup">
            <p>There are two entry points to the connect wizard:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li><strong>Dashboard → Domains → Add domain → Use my own AWS account → Connect a new AWS account</strong>, or</li>
              <li><strong>Dashboard → Settings → Connect AWS account</strong>.</li>
            </ul>
            <p>The wizard has three steps:</p>
            <div className="mt-4 space-y-3">
              <p><strong>1. Alias &amp; region.</strong> Pick a friendly name for the account (e.g. <em>Production</em>) and the AWS region you want the resources provisioned in (e.g. <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">us-east-1</code>).</p>
              <p><strong>2. Deploy the CloudFormation stack.</strong> Click <strong>Open CloudFormation in AWS</strong>. The Quick-Create URL opens the AWS console and pre-fills every parameter for you:</p>
              <ul className="ml-8 list-disc space-y-1">
                <li><code className="rounded bg-gray-100 px-1 dark:bg-gray-800">ExternalId</code> - unique per-account value Mailmark will present when assuming the role.</li>
                <li><code className="rounded bg-gray-100 px-1 dark:bg-gray-800">MailmarkAwsAccountId</code> - the Mailmark AWS account ID, used in the role trust policy.</li>
                <li><code className="rounded bg-gray-100 px-1 dark:bg-gray-800">WebhookSecret</code> - shared secret used to sign webhook payloads.</li>
                <li><code className="rounded bg-gray-100 px-1 dark:bg-gray-800">InboundWebhookUrl</code> / <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">SendingWebhookUrl</code> - the Mailmark endpoints your Lambda / SNS will POST to.</li>
              </ul>
              <p>Sign in with the AWS account you want to use, review the parameters, acknowledge the IAM capabilities checkbox, and click <strong>Create stack</strong>.</p>
              <p><strong>3. Paste the outputs.</strong> When the stack status turns <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">CREATE_COMPLETE</code>, open the <strong>Outputs</strong> tab in the AWS console and copy two values:</p>
              <ul className="ml-8 list-disc space-y-1">
                <li><code className="rounded bg-gray-100 px-1 dark:bg-gray-800">RoleArn</code> - e.g. <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">arn:aws:iam::123456789012:role/mailmark-...</code></li>
                <li><code className="rounded bg-gray-100 px-1 dark:bg-gray-800">BucketName</code> - the S3 bucket for inbound email.</li>
              </ul>
              <p>Paste both into the Mailmark wizard and click <strong>Verify</strong>. Mailmark will:</p>
              <ul className="ml-8 list-disc space-y-1">
                <li>Call <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">STS.AssumeRole</code> using your RoleArn and ExternalId.</li>
                <li>Confirm identity with <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">STS.GetCallerIdentity</code>.</li>
                <li>Probe <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">SES.GetAccount</code> to detect whether your SES account is still in the sandbox.</li>
              </ul>
              <p>On success the account status flips to <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">Verified</span> and it becomes available as an infrastructure target when adding domains.</p>
            </div>
          </Section>

          <Section id="ongoing" title="Ongoing behavior">
            <p><strong>SES sandbox.</strong> Fresh AWS accounts start with SES in sandbox mode, which only allows sending to verified recipients. If Mailmark detects your account is in the sandbox, a <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">SES sandbox</span> badge is shown next to the account in Settings and the Add-Domain picker. <a href="https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html" className="text-violet-600 hover:underline">Request production access</a> in the AWS console to remove it.</p>
            <p><strong>Multiple domains, one AWS account.</strong> A connected AWS account can host any number of Mailmark domains. The Settings page lists every linked domain for each account.</p>
            <p><strong>Re-verification.</strong> Mailmark caches the verification result. If you rotate the IAM role, delete and recreate the stack, or change the <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">ExternalId</code>, the next operation that requires AssumeRole will fail and the account status will flip to <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">Failed</span> with the AWS error message shown inline.</p>
          </Section>

          <Section id="disconnect" title="Disconnecting an AWS account">
            <p>
              To disconnect, go to <strong>Dashboard → Settings</strong>, find the account card, and click <strong>Disconnect</strong> → <strong>Confirm disconnect</strong>.
            </p>
            <WarnBox>
              Disconnect is <strong>blocked while any domain is still linked</strong> to the account. The Settings card lists the offending domains - delete them in Mailmark first (Dashboard → Domains → [domain] → Delete), then retry the disconnect.
            </WarnBox>
            <p>
              Disconnecting only removes the link between Mailmark and your AWS account. <strong>The CloudFormation stack in your AWS account is not deleted by Mailmark.</strong> To free up the resources, delete the stack yourself in the AWS console - it will remove the S3 bucket (only if empty), SES identity, Lambda, SNS topics, and IAM role together.
            </p>
          </Section>

          <Section id="troubleshooting" title="Troubleshooting">
            <p className="font-semibold text-gray-900 dark:text-white">&ldquo;AssumeRole failed&rdquo; / &ldquo;Could not assume role&rdquo;</p>
            <p>
              Mailmark could not call <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">STS.AssumeRole</code> on your role. Common causes:
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>The role&apos;s trust policy does not allow Mailmark&apos;s AWS account as principal. Re-check the <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">MailmarkAwsAccountId</code> parameter on the stack matches the value shown in the wizard.</li>
              <li>The <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">ExternalId</code> on the stack differs from the one Mailmark was issued. Recreate the stack with the exact <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">ExternalId</code> from the wizard, or re-run the wizard from scratch to get a fresh one.</li>
              <li>You pasted a different role&apos;s ARN. The wizard expects the role ARN listed under the stack&apos;s <strong>Outputs</strong> tab, not a role you created by hand.</li>
            </ul>

            <p className="mt-4 font-semibold text-gray-900 dark:text-white">&ldquo;TemplateURL must be a supported URL&rdquo; when clicking Open CloudFormation in AWS</p>
            <p>
              This is an operator-side configuration error: the Mailmark deployment is missing the <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">MAILMARK_CFN_TEMPLATE_URL</code> environment variable, or it points to a non-S3 URL. AWS CloudFormation only accepts template URLs hosted on S3. If you are self-hosting Mailmark, upload <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">public/infra/byo-aws-cfn.yml</code> to a public-readable S3 object and set <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">MAILMARK_CFN_TEMPLATE_URL</code> to that URL in Convex. Otherwise, contact Mailmark support.
            </p>

            <p className="mt-4 font-semibold text-gray-900 dark:text-white">SES sandbox badge keeps showing even after production access is granted</p>
            <p>
              Mailmark rechecks <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">SES.GetAccount</code> on the next verification. Go to Settings and reconnect (or wait for the next scheduled re-check) to refresh the sandbox state.
            </p>
          </Section>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {[
              { href: "/docs/domain-setup", title: "Domain Setup", desc: "DNS records are identical for Mailmark-hosted and BYO-AWS domains." },
              { href: "/docs/troubleshooting", title: "Troubleshooting", desc: "General fixes for domain verification and delivery issues." },
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
