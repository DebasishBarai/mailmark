import CTAButton from "./CTAButton";

const plans = [
  {
    name: "Starter",
    price: "Free",
    period: "forever",
    description: "Perfect for individuals getting started with custom domain email.",
    features: [
      "1 custom domain",
      "3 mailboxes",
      "Full email UI",
      "5 GB storage",
      "Basic support",
    ],
    cta: "Get Started Free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "per month",
    description: "For growing teams that need more power and campaign tools.",
    features: [
      "5 custom domains",
      "Unlimited mailboxes",
      "Email campaigns",
      "Campaign analytics",
      "50 GB storage",
      "Priority support",
    ],
    cta: "Start Pro Trial",
    highlighted: true,
  },
  {
    name: "Business",
    price: "$99",
    period: "per month",
    description: "Unlimited scale with white-glove onboarding for your whole team.",
    features: [
      "Unlimited domains",
      "Unlimited mailboxes",
      "Advanced campaigns",
      "Team collaboration",
      "500 GB storage",
      "Dedicated support",
    ],
    cta: "Contact Sales",
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
    <section id="pricing" className="bg-white px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Start free and scale as you grow. No hidden fees, no surprises.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl p-8 shadow-sm transition-shadow hover:shadow-md ${
                plan.highlighted
                  ? "bg-violet-600 text-white ring-2 ring-violet-600"
                  : "border border-gray-200 bg-white"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-violet-900 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow">
                  Most Popular
                </span>
              )}

              <div>
                <h3
                  className={`text-lg font-semibold ${plan.highlighted ? "text-white" : "text-gray-900"}`}
                >
                  {plan.name}
                </h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span
                    className={`text-4xl font-bold tracking-tight ${plan.highlighted ? "text-white" : "text-gray-900"}`}
                  >
                    {plan.price}
                  </span>
                  <span
                    className={`text-sm ${plan.highlighted ? "text-violet-200" : "text-gray-500"}`}
                  >
                    /{plan.period}
                  </span>
                </div>
                <p
                  className={`mt-3 text-sm ${plan.highlighted ? "text-violet-100" : "text-gray-600"}`}
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
                      className={`text-sm ${plan.highlighted ? "text-violet-100" : "text-gray-600"}`}
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
                ) : plan.name === "Business" ? (
                  <a
                    href="mailto:sales@devmail.app"
                    className="inline-flex w-full items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                  >
                    {plan.cta}
                  </a>
                ) : (
                  <CTAButton className="inline-flex w-full items-center justify-center rounded-full border border-violet-600 bg-white px-6 py-3 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-50">
                    {plan.cta}
                  </CTAButton>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-gray-500">
          All plans include a 14-day free trial. No credit card required to get started.
        </p>
      </div>
    </section>
  );
}
