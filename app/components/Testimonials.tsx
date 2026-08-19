import SectionHeader from "./SectionHeader";

const testimonials = [
  {
    quote:
      "We switched all our outreach campaigns to Mailmark. Setting up our domain took 5 minutes, and now every campaign goes out from our own address. Open rates jumped 30%.",
    // name: "Sarah C.",
    // role: "Head of Sales, SaaS Startup",
    name: "Mailmark User",
    role: "Head of Sales",
    stars: 5,
  },
  {
    quote:
      "Finally, one platform for running email campaigns with real deliverability. No more juggling Mailchimp, a warming tool, and a separate inbox for replies.",
    // name: "Marcus J.",
    // role: "Founder, Growth Agency",
    name: "Seasoned Entrepreneur",
    role: "Startup Founder",
    stars: 5,
  },
  {
    quote:
      "The campaign tools are powerful and the reply management feels just like Gmail. I run outreach from sales@ and newsletters from updates@, all in one place.",
    // name: "Priya P.",
    // role: "Marketing Director, E-commerce",
    name: "Mailmark User",
    role: "Marketing Director",
    stars: 5,
  },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="flex text-yellow-400">
      {[...Array(count)].map((_, i) => (
        <svg key={i} className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function Testimonials() {
  return (
    <section className="bg-gray-50 px-6 py-24 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          index="08"
          label="What people say"
          title="Loved by businesses everywhere"
          subtitle="See why teams choose Mailmark for their email campaigns."
        />
        <div className="grid gap-8 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="flex flex-col rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
            >
              <Stars count={t.stars} />
              <p className="mt-4 flex-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-6 flex items-center gap-3 border-t border-gray-100 pt-4 dark:border-gray-700">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">
                  {t.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{t.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
