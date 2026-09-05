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

// Every 6 hours: re-measure complaint and bounce rates, and stop any domain
// that has crossed the thresholds in convex/lib/reputation.ts.
//
// Deliberately infrequent. Every complaint and every hard bounce already
// schedules a measurement of its own domain as it arrives, and those are the
// only two events that can push a rate upward, so a spike is caught within
// seconds without this. What the sweep covers is the notification that never
// reached us because SNS dropped it, and a domain whose sending volume fell
// away underneath a fixed number of complaints. Each pass walks the sent
// folder of every mailbox on every verified domain, so running it hourly would
// cost twenty-four of those walks a day to catch what the send path has
// already caught.
crons.interval(
  "reputation guard sweep",
  { hours: 6 },
  internal.reputationGuard.evaluateAllDomains,
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

// Daily at 3:52 AM UTC: rebuild the per-mailbox and per-domain stat rows.
//
// Fifteen minutes after the platform counter reconcile so the two walks do not
// compete, and off the quarter hours the warmup crons occupy.
crons.daily(
  "rebuild entity stats",
  { hourUTC: 3, minuteUTC: 52 },
  internal.platformStats.startEntityStatsRebuild,
  {}
);

// Every 5 minutes: replay SES sending events that arrived before the message
// row they describe.
//
// sendEmail calls SES, then writes to S3, then inserts the row, and a hard
// bounce from a dead mailbox comes back faster than that sequence completes.
// The notification handler used to find no row, log, and drop the event, which
// is how messages have sat in pending since March. They are parked now, and
// this drains the parking lot.
crons.interval(
  "replay pending delivery events",
  { minutes: 5 },
  internal.emails.replayPendingDeliveryEventsBatch,
  {}
);

// Every 15 minutes: check on bulk verification files awaiting results.
//
// flushBatch schedules its own poll, so this is the belt to that braces: a
// scheduled job lost to a deploy would otherwise leave a paid-for file
// permanently unapplied.
crons.interval(
  "poll bulk verification files",
  { minutes: 15 },
  internal.verificationBackfill.pollFiles,
  {}
);

// Every 15 minutes, off the quarter hours: restart a backfill scan whose
// scheduled chain has gone.
//
// The scan is a chain of self-scheduling actions, hundreds of links long, and
// Convex neither retries a scheduled function that throws nor carries one
// across a deploy. The file half of the backfill has had the cron above to
// cover that from the start; the walk half had nothing, so a broken link left
// a run sitting at "collecting" with an updatedAt that had stopped moving and
// nothing to notice it. Steps retry themselves now; this is the belt to that
// braces, for the failure that stops a step from running at all.
crons.cron(
  "resume stalled verification backfill",
  "8,23,38,53 * * * *",
  internal.verificationBackfill.resumeStalled,
  {}
);

// Daily at 4:20 AM UTC: re-verify addresses whose verdict has expired.
//
// Contact data decays at roughly 2% a month, so at the 90 day TTL about a
// ninetieth of the table comes due each day. Doing it daily keeps the spend
// flat rather than arriving as one bill, and keeps the send path from ever
// finding a stale result. Off the quarter hours the warmup crons occupy, and
// after the nightly reconciles.
crons.daily(
  "revalidate expired verifications",
  { hourUTC: 4, minuteUTC: 20 },
  internal.verification.revalidateExpired,
  {}
);

export default crons;
