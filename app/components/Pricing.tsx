import CTAButton from "./CTAButton";
import SectionHeader from "./SectionHeader";

const plans = [
  {
    name: "Starter",
    price: "$10",
    period: "per month",
    description: "Perfect for your first product's email.",
    features: [
      "1,000 emails / month",
      "1 custom domain",
      "3 mailboxes",
      "Full email UI",
      "User campaigns",
      "REST API & npm SDK",
      "Basic support",
    ],
    cta: "Start 7-Day Free Trial",
    hasTrial: true,
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$50",
    period: "per month",
    description: "For developers running several products at once.",
    features: [
      "25,000 emails / month",
      "5 custom domains",
      "Unlimited mailboxes",
      "Full email UI",
      "User campaigns",
      "REST API & npm SDK",
      "Priority support",
    ],
    cta: "Start 7-Day Free Trial",
    hasTrial: true,
    highlighted: true,
  },
  {
    name: "Business",
    price: "$100",
    period: "per month",
    description: "For a whole portfolio of products, with room to grow.",
    features: [
      "100,000 emails / month",
      "Unlimited domains",
      "Unlimited mailboxes",
      "Full email UI",
      "User campaigns",
      "REST API & npm SDK",
      "Dedicated support",
    ],
    // cta: "Start 7-Day Free Trial",
    cta: "Get Started",
    hasTrial: false,
    highlighted: false,
  },
];

function CheckIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function Pricing() {
  return (
    <section id="pricing" className="bg-white px-6 py-24 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl">
        {/* Old subtitle: Every plan includes a 7-day free trial. No credit card required. */}
        <SectionHeader
          index="09"
          label="Pricing"
          title="Priced by how much you ship"
          subtitle="Starter and Pro include a 7-day free trial. Billing details are taken when you start it, nothing is charged until day 8, and cancelling before then costs you nothing."
        />

        {/* Trial banner */}
        <div className="mx-auto max-w-2xl rounded-2xl border border-violet-200 bg-violet-50 px-6 py-4 text-center dark:border-violet-800 dark:bg-violet-950/30">
          <p className="text-sm font-medium text-violet-800 dark:text-violet-300">
            {/* Try any plan free for 7 days with full access. No credit card needed. Your account pauses after the trial until you choose a plan. */}
            Try Starter or Pro free for 7 days with full access. Cancel anytime during the trial, no charge.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl p-8 shadow-sm transition-shadow hover:shadow-md ${plan.highlighted
                  ? "bg-violet-600 text-white ring-2 ring-violet-600"
                  : "border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
                }`}
            >
              {plan.highlighted && (
                /* Old badge used bg-violet-900, which light themes (Warm Cream,
                   Notion, Pastel Soft) remap to a pale tint, making the cream
                   text-white label invisible. violet-800 stays dark in every theme.
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-violet-900 px-4 py-1 font-mono text-[0.65rem] font-medium uppercase tracking-[0.12em] text-white shadow">
                  Most Popular
                </span>
                */
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-violet-800 px-4 py-1 font-mono text-[0.65rem] font-medium uppercase tracking-[0.12em] text-white shadow ring-1 ring-white/20">
                  Most Popular
                </span>
              )}

              <div>
                <h3
                  className={`font-display text-lg ${plan.highlighted ? "text-white" : "text-gray-900 dark:text-white"}`}
                >
                  {plan.name}
                </h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span
                    className={`font-display text-4xl ${plan.highlighted ? "text-white" : "text-gray-900 dark:text-white"}`}
                  >
                    {plan.price}
                  </span>
                  <span
                    className={`text-sm ${plan.highlighted ? "text-violet-200" : "text-gray-500 dark:text-gray-400"}`}
                  >
                    /{plan.period}
                  </span>
                </div>
                {/* 7-day free trial included – only for plans with hasTrial */}
                {plan.hasTrial && (
                <p
                  className={`mt-1 text-xs font-medium ${plan.highlighted ? "text-violet-200" : "text-violet-600 dark:text-violet-400"}`}
                >
                  7-day free trial included
                </p>
                )}
                <p
                  className={`mt-3 text-sm ${plan.highlighted ? "text-violet-100" : "text-gray-600 dark:text-gray-400"}`}
                >
                  {plan.description}
                </p>
              </div>

              <ul className="mt-8 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <span
                      className={plan.highlighted ? "text-violet-200" : "text-violet-600"}
                    >
                      <CheckIcon />
                    </span>
                    <span
                      className={`text-sm ${plan.highlighted ? "text-violet-100" : "text-gray-600 dark:text-gray-400"}`}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                {plan.highlighted ? (
                  <CTAButton className="inline-flex w-full items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-violet-700 shadow transition-all hover:bg-gray-50 hover:shadow-md">
                    {plan.cta}
                  </CTAButton>
                ) : (
                  <CTAButton className="inline-flex w-full items-center justify-center rounded-full border border-violet-600 bg-white px-6 py-3 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-50 dark:bg-gray-700 dark:text-violet-300 dark:hover:bg-violet-900/30">
                    {plan.cta}
                  </CTAButton>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
