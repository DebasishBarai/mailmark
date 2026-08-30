import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Every day at midnight UTC: delete unverified domains older than 7 days
crons.daily(
  "cleanup unverified domains",
  { hourUTC: 0, minuteUTC: 0 },
  internal.domainActions.cleanupUnverifiedDomainsInternal,
  { olderThanDays: 7 }
);

// Every day at 6am UTC: advance warming schedules to next day
crons.daily(
  "advance warming schedules",
  { hourUTC: 6, minuteUTC: 0 },
  internal.warmingActions.advanceAllSchedules,
  {}
);

// Every 12 hours: run domain health checks
crons.interval(
  "domain health checks",
  { hours: 12 },
  internal.domainHealth.runHealthCheckForAllDomains,
  {}
);

// Every hour: re-check domains still waiting on SES verification.
// Domain status used to refresh only when the owner clicked "Verify DNS",
// so a domain SES verified an hour after the last click stayed unverified
// in our database until someone happened to look again.
crons.interval(
  "reverify pending domains",
  { hours: 1 },
  internal.domainActions.reverifyPendingDomainsInternal,
  {}
);

// Every 30 minutes: send warmup emails (mailbox <-> platform Gmail accounts).
//
// These two were interval crons, which anchor to deploy time and take no
// offset, so the 15 minute gap the engagement comment claimed did not exist:
// both could land on the same tick and check placement for a message Gmail had
// not finished delivering. Fixed times give the offset the design wanted.
// crons.interval("warmup exchange", { minutes: 30 }, ...)
crons.cron(
  "warmup exchange",
  "0,30 * * * *",
  internal.warmupEngine.runWarmupRound,
  {}
);

// 15 minutes after each exchange round: Gmail engagement on delivered warmup
// emails, by which point Gmail has had time to file them.
// crons.interval("warmup engagement", { minutes: 30 }, ...)
crons.cron(
  "warmup engagement",
  "15,45 * * * *",
  internal.warmupEngagement.runEngagementRound,
  {}
);

// Daily at 6:30 AM UTC: advance warmup days, reset counters, recalculate health scores
crons.daily(
  "advance warmup day",
  { hourUTC: 6, minuteUTC: 30 },
  internal.warmupEngine.advanceWarmupDay,
  {}
);

// Daily at 3:37 AM UTC: recompute the denormalized platform counters that
// platformStats reads, from the underlying tables.
//
// The counters are maintained incrementally by convex/lib/counters.ts, so this
// exists to repair drift rather than to produce the numbers: a mutation added
// later that forgets to call into counters.ts, a row edited by hand in the
// Convex dashboard, or a race during the walk itself. Each run recounts from
// scratch, so errors never accumulate.
//
// The time is deliberately off the quarter hour: the warmup exchange and
// engagement crons occupy :00/:15/:30/:45, and the reconcile is most accurate
// when few mutations are running against the tables it is walking.
crons.daily(
  "reconcile platform counters",
  { hourUTC: 3, minuteUTC: 37 },
  internal.platformStats.startCounterReconcile,
  {}
);

export default crons;
