const testimonials = [
  {
    quote:
      "I run three products. Every domain, every inbox, and every product update now lives in one tab instead of three Google Workspace accounts and a separate ESP.",
    name: "Indie Hacker",
    role: "3 products, solo",
    color: "bg-vivid-yellow",
    stars: 5,
  },
  {
    quote:
      "The API was the reason I switched. npm i mailmark-sdk and my apps send their own welcome emails and receipts. No more wiring up a separate provider per project.",
    name: "Solo Developer",
    role: "Full-stack founder",
    color: "bg-aquamarine",
    stars: 5,
  },
  {
    quote:
      "I shipped v2 and emailed my whole user base without anyone seeing the other recipients. Mail merge made it feel personal, and it actually landed in the inbox.",
    name: "SaaS Founder",
    role: "Bootstrapped",
    color: "bg-lavender-rose",
    stars: 5,
  },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="flex text-black">
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
    <section className="border-b-2 border-black bg-champagne px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <span className="mb-4 inline-block rounded-full border-2 border-black bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-black">
            From founders like you
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-black md:text-4xl">
            Built for people running more than one thing
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-black/70">
            Solo developers who were tired of five tools just to talk to their
            users.
          </p>
        </div>
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="flex flex-col rounded-xl border-2 border-black bg-white p-8 shadow-[4px_4px_0px_#000] transition-all hover:-translate-y-1 hover:shadow-[7px_7px_0px_#000]"
            >
              <Stars count={t.stars} />
              <p className="mt-4 flex-1 text-sm leading-relaxed text-black/80">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-6 flex items-center gap-3 border-t-2 border-black pt-4">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-2 border-black ${t.color} text-xs font-extrabold text-black`}>
                  {t.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="text-sm font-extrabold text-black">{t.name}</p>
                  <p className="text-xs font-semibold text-black/60">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
