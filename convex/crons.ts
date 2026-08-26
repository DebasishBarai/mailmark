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

// Every 30 minutes: send warmup emails (mailbox <-> platform Gmail accounts)
crons.interval(
  "warmup exchange",
  { minutes: 30 },
  internal.warmupEngine.runWarmupRound,
  {}
);

// Every 30 minutes (offset 15 min): Gmail engagement on received warmup emails
crons.interval(
  "warmup engagement",
  { minutes: 30 },
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

export default crons;
