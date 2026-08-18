import CTAButton from "./CTAButton";

export default function CTABanner() {
  return (
    <section id="cta" className="bg-white px-6 py-24">
      <div className="mx-auto max-w-4xl rounded-2xl border-2 border-black bg-coral px-8 py-16 text-center shadow-[10px_10px_0px_#000] md:px-16">
        <h2 className="text-3xl font-extrabold tracking-tight text-black md:text-4xl">
          Bring all your products&apos; email under one roof
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg font-medium text-black/80">
          Add your domains, spin up mailboxes, send your users an update, and
          send from code, all in one place. Try free for 7 days, no credit card
          required.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <CTAButton className="inline-flex items-center gap-2 rounded-md border-2 border-black bg-vivid-yellow px-8 py-3.5 text-base font-bold text-black shadow-[4px_4px_0px_#000] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_#000]">
            Start Free Trial
          </CTAButton>
          <a
            href="#developers"
            className="inline-flex items-center rounded-md border-2 border-black bg-white px-8 py-3.5 text-base font-bold text-black shadow-[4px_4px_0px_#000] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_#000]"
          >
            Explore the API
          </a>
        </div>
      </div>
    </section>
  );
}
