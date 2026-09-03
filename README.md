This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Email validation and suppression

Outbound mail passes through a single eligibility gate (`convex/sendGate.ts`)
before it reaches SES, on every path: compose, the scheduled queue, the public
API, and sequence steps.

### Required environment variable

```
MILLIONVERIFIER_API_KEY=...
```

Set it on the Convex deployment (`npx convex env set MILLIONVERIFIER_API_KEY ...`).
It is read only from the environment and must never be committed. Without it,
verification lookups report as unavailable and the configured
`onVerifierUnavailable` policy applies.

### Policy

Defaults live in `convex/lib/sendPolicy.ts`, the single place send policy is
decided. Three of them can be changed at runtime without a deploy, via
`sendingControls.setPolicy`:

| Setting | Default | Effect |
| --- | --- | --- |
| `catchAllPolicy` | `allow` | How to treat domains that accept every address. The main lever if the bounce rate climbs toward the 5% at which AWS suspends an account. |
| `unknownPolicy` | `allow` | How to treat lookups the verifier could not resolve. |
| `onVerifierUnavailable` | `hold` | Whether an outage holds messages or releases them. |
| `verificationTtlDays` | `90` | How long a verification result is trusted before re-checking. |

### Kill switch

`sendingControls.setSendingPaused({ paused: true })` halts all user-facing
outbound sending immediately. Scheduled mail is held rather than cancelled: its
job re-arms itself while the switch is on, so lifting it resumes the queue where
it stopped. Warmup traffic has a separate switch (`setWarmupPaused`) because
stopping a reputation ramp mid-run is costly and warmup carries no list risk.

### Backfilling the existing queue

`verificationBackfill.start` walks the outbox a page at a time, submits unique
unverified recipients to MillionVerifier's bulk endpoint in files of 5,000, and
applies the verdicts to the shared verification cache. Progress is readable via
`verificationBackfillQueries.getProgress`. Pause sending first if you want the
queue held while it runs.
