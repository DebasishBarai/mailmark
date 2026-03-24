import CTAButton from "./CTAButton";

export default function CTABanner() {
  return (
    <section id="cta" className="px-6 py-24">
      <div className="mx-auto max-w-4xl rounded-3xl bg-gradient-to-r from-violet-600 to-purple-700 px-8 py-16 text-center shadow-2xl md:px-16">
        <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
          Ready to launch your first campaign?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-violet-100">
          Connect your domain, set up sender mailboxes, and start sending
          personalized campaigns in minutes. Try free for 7 days, no credit card required.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <CTAButton className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-semibold text-violet-700 shadow-lg transition-all hover:bg-gray-50 hover:shadow-xl">
            Start Free Trial
          </CTAButton>
          <a
            href="#how-it-works"
            className="inline-flex items-center rounded-full border border-white/30 px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10"
          >
            See How It Works
          </a>
        </div>
      </div>
    </section>
  );
}
