import CTAButton from "./CTAButton";

const plans = [
  {
    name: "Starter",
    price: "$10",
    period: "per month",
    description: "Perfect for individuals getting started with custom domain email.",
    features: [
      "1,000 emails / month",
      "1 custom domain",
      "3 mailboxes",
      "Full email UI",
      "5 GB storage",
      "Basic support",
    ],
    cta: "Start 7-Day Free Trial",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$25",
    period: "per month",
    description: "For growing teams that need more power and campaign tools.",
    features: [
      "25,000 emails / month",
      "5 custom domains",
      "Unlimited mailboxes",
      "Email campaigns",
      "Campaign analytics",
      "50 GB storage",
      "Priority support",
    ],
    cta: "Start 7-Day Free Trial",
    highlighted: true,
  },
  {
    name: "Business",
    price: "$75",
    period: "per month",
    description: "Unlimited scale with white-glove onboarding for your whole team.",
    features: [
      "100,000 emails / month",
      "Unlimited domains",
      "Unlimited mailboxes",
      "Advanced campaigns",
      "Team collaboration",
      "500 GB storage",
      "Dedicated support",
    ],
    cta: "Start 7-Day Free Trial",
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
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
            Every plan includes a 7-day free trial. No credit card required.
          </p>
        </div>

        {/* Trial banner */}
        <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-violet-200 bg-violet-50 px-6 py-4 text-center dark:border-violet-800 dark:bg-violet-950/30">
          <p className="text-sm font-medium text-violet-800 dark:text-violet-300">
            Try any plan free for 7 days with full access. No credit card needed — your account pauses after the trial until you choose a plan.
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
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-violet-900 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow">
                  Most Popular
                </span>
              )}

              <div>
                <h3
                  className={`text-lg font-semibold ${plan.highlighted ? "text-white" : "text-gray-900 dark:text-white"}`}
                >
                  {plan.name}
                </h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span
                    className={`text-4xl font-bold tracking-tight ${plan.highlighted ? "text-white" : "text-gray-900 dark:text-white"}`}
                  >
                    {plan.price}
                  </span>
                  <span
                    className={`text-sm ${plan.highlighted ? "text-violet-200" : "text-gray-500 dark:text-gray-400"}`}
                  >
                    /{plan.period}
                  </span>
                </div>
                <p
                  className={`mt-1 text-xs font-medium ${plan.highlighted ? "text-violet-200" : "text-violet-600 dark:text-violet-400"}`}
                >
                  7-day free trial included
                </p>
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
