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

// Daily at 3:15 AM UTC: delete resume uploads that were never attached to a
// job application (abandoned careers forms)
crons.daily(
  "cleanup orphaned resumes",
  { hourUTC: 3, minuteUTC: 15 },
  internal.jobApplications.cleanupOrphanedResumes,
  {}
);

export default crons;
