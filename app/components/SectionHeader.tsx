import type { ReactNode } from "react";

/**
 * The landing page's section header, in the editorial style: a numbered
 * monospace label with a rule running off to the right, then the headline and
 * its standfirst side by side.
 *
 * Every numbered section on the page renders through this, so the numbering
 * stays sequential and the type, spacing and alignment cannot drift apart the
 * way ten hand-matched copies would.
 *
 * `index` is the section's position on the page, counting only the sections
 * that carry a header. The stat, logo and closing CTA bands are deliberately
 * unnumbered.
 */
export default function SectionHeader({
  index,
  label,
  title,
  subtitle,
}: {
  index: string;
  label: string;
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="mb-14">
      <div className="mb-6 flex items-center gap-4">
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
          {index} / {label}
        </span>
        <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="grid gap-4 md:grid-cols-[1.15fr_1fr] md:items-end md:gap-14">
        <h2 className="font-display text-3xl leading-[1.06] text-gray-900 dark:text-white md:text-4xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="text-lg text-gray-600 dark:text-gray-400">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
