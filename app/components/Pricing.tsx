import CTAButton from "./CTAButton";

const plans = [
  {
    name: "Starter",
    price: "$10",
    period: "per month",
    description: "For your first product or two.",
    features: [
      "1,000 emails / month",
      "1 custom domain",
      "3 mailboxes",
      "Full email UI",
      "Campaigns with mail merge",
      "REST API + npm SDK",
      "Campaign analytics",
    ],
    cta: "Start 7-Day Free Trial",
    hasTrial: true,
    highlighted: false,
    color: "bg-white",
  },
  {
    name: "Pro",
    price: "$50",
    period: "per month",
    description: "For a growing portfolio of products.",
    features: [
      "25,000 emails / month",
      "5 custom domains",
      "Unlimited mailboxes",
      "Full email UI",
      "Campaigns with mail merge",
      "REST API + npm SDK",
      "Priority support",
    ],
    cta: "Start 7-Day Free Trial",
    hasTrial: true,
    highlighted: true,
    color: "bg-coral",
  },
  {
    name: "Business",
    price: "$100",
    period: "per month",
    description: "For a full stable of products at scale.",
    features: [
      "100,000 emails / month",
      "Unlimited domains",
      "Unlimited mailboxes",
      "Full email UI",
      "Campaigns with mail merge",
      "REST API + npm SDK",
      "Dedicated support",
    ],
    cta: "Get Started",
    hasTrial: false,
    highlighted: false,
    color: "bg-white",
  },
];

function CheckIcon() {
  return (
    <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

export default function Pricing() {
  return (
    <section id="pricing" className="border-b-2 border-black bg-white px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <span className="mb-4 inline-block rounded-full border-2 border-black bg-vivid-yellow px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-black">
            Pricing
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-black md:text-4xl">
            One bill for all your products
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-black/70">
            Every plan includes the dashboard, campaigns, and the API. Starter
            and Pro come with a 7-day free trial.
          </p>
        </div>

        {/* Trial banner */}
        <div className="mx-auto mt-10 max-w-2xl rounded-xl border-2 border-black bg-aquamarine px-6 py-4 text-center shadow-[4px_4px_0px_#000]">
          <p className="text-sm font-bold text-black">
            Try Starter or Pro free for 7 days with full access. Cancel anytime
            during the trial, no charge.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-xl border-2 border-black p-8 ${plan.color} ${
                plan.highlighted
                  ? "shadow-[8px_8px_0px_#000] md:-translate-y-2"
                  : "shadow-[4px_4px_0px_#000]"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full border-2 border-black bg-vivid-yellow px-4 py-1 text-xs font-extrabold uppercase tracking-wide text-black shadow-[2px_2px_0px_#000]">
                  Most Popular
                </span>
              )}

              <div>
                <h3 className="text-lg font-extrabold text-black">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tracking-tight text-black">
                    {plan.price}
                  </span>
                  <span className="text-sm font-semibold text-black/60">
                    /{plan.period}
                  </span>
                </div>
                {plan.hasTrial && (
                  <p className="mt-1 text-xs font-bold text-black/70">
                    7-day free trial included
                  </p>
                )}
                <p className="mt-3 text-sm font-medium text-black/70">
                  {plan.description}
                </p>
              </div>

              <ul className="mt-8 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-black bg-white">
                      <CheckIcon />
                    </span>
                    <span className="text-sm font-medium text-black/80">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <CTAButton
                  className={`inline-flex w-full items-center justify-center rounded-md border-2 border-black px-6 py-3 text-sm font-bold text-black shadow-[4px_4px_0px_#000] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_#000] ${
                    plan.highlighted ? "bg-vivid-yellow" : "bg-white"
                  }`}
                >
                  {plan.cta}
                </CTAButton>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
