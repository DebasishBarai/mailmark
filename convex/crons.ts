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

export default crons;
