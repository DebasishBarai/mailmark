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

export default crons;
