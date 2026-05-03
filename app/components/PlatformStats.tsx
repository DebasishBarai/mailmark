"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import RollingCounter from "./RollingCounter";

// function AnimatedNumber({ value }: { value: number }) {
//   const [display, setDisplay] = useState(0);
//   const ref = useRef<HTMLSpanElement>(null);
//   const hasAnimated = useRef(false);
//
//   useEffect(() => {
//     const el = ref.current;
//     if (!el || hasAnimated.current || value === 0) return;
//
//     const observer = new IntersectionObserver(
//       ([entry]) => {
//         if (!entry.isIntersecting || hasAnimated.current) return;
//         hasAnimated.current = true;
//         observer.disconnect();
//
//         const duration = 2000;
//         const start = performance.now();
//
//         function tick(now: number) {
//           const elapsed = now - start;
//           const progress = Math.min(elapsed / duration, 1);
//           const eased = 1 - Math.pow(1 - progress, 3);
//           setDisplay(Math.floor(eased * value));
//           if (progress < 1) requestAnimationFrame(tick);
//         }
//
//         requestAnimationFrame(tick);
//       },
//       { threshold: 0.3 }
//     );
//
//     observer.observe(el);
//     return () => observer.disconnect();
//   }, [value]);
//
//   return <span ref={ref}>{display.toLocaleString()}</span>;
// }

const statsConfig = [
  {
    key: "totalEmails" as const,
    label: "Emails processed",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
  },
  {
    key: "totalDomains" as const,
    label: "Verified domains",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
  },
  {
    key: "totalMailboxes" as const,
    label: "Active mailboxes",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
      </svg>
    ),
  },
];

export default function PlatformStats() {
  const stats = useQuery(api.platformStats.getStats);

  return (
    <section className="border-y border-gray-100 bg-white px-6 py-16 dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto max-w-5xl">
        <p className="mb-10 text-center text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Trusted by growing businesses
        </p>
        <div className="grid gap-8 sm:grid-cols-3">
          {statsConfig.map((s) => (
            <div key={s.key} className="flex flex-col items-center text-center">
              <div className="rounded-xl bg-violet-100 p-3 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">
                {s.icon}
              </div>
              <p className="mt-4 text-3xl font-extrabold text-gray-900 dark:text-white">
                {stats ? <RollingCounter value={stats[s.key]} /> : "-"}
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
