/**
 * Reputation thresholds, and the arithmetic behind the sending brake.
 *
 * Pure functions and constants only, so both the send gate (Convex runtime)
 * and the health check (node runtime) can read the same numbers.
 *
 * The figures below are AWS's, not ours. SES publishes two review thresholds
 * for a sending account:
 *
 *   complaint rate  0.1% = "at risk", 0.5% = account under review
 *   bounce rate     5%   = "at risk", 10% = account under review
 *
 * A brake that only trips at AWS's own review line is a brake that trips once
 * the damage is done, so the pause thresholds here sit below it: the account
 * stops sending from the offending domain while there is still headroom to
 * recover, rather than after SES has already opened a case.
 */

/** Rolling window the rates are measured over. */
export const REPUTATION_WINDOW_DAYS = 7;
export const REPUTATION_WINDOW_MS = REPUTATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/**
 * Below this many sends in the window, no rate is computed at all.
 *
 * A rate over a handful of messages is noise: one complaint against twenty
 * sends reads as 5%, which would pause a brand new domain over a single
 * recipient who was having a bad day. SES itself does not act on low volume
 * for the same reason.
 */
export const REPUTATION_MIN_VOLUME = 100;

/**
 * How long a domain's reading stays fresh before a new complaint is allowed to
 * trigger another measurement. Complaints arrive in bursts, and a burst should
 * cost one seven-day walk rather than one per complaint.
 */
export const REPUTATION_RECHECK_MS = 5 * 60 * 1000;

/** Complaint rate, as a fraction (0.001 = 0.1%). */
export const COMPLAINT_WARN_RATE = 0.001;
export const COMPLAINT_PAUSE_RATE = 0.003;

/**
 * Bounce rate, as a fraction. Counted over hard and soft bounces together,
 * which is what SES counts.
 *
 * The pause line is 8% rather than AWS's 10%: crossing 10% is the point at
 * which sending can be suspended outright, and a brake has to engage before
 * the cliff to be worth having.
 */
export const BOUNCE_WARN_RATE = 0.05;
export const BOUNCE_PAUSE_RATE = 0.08;

export type ReputationCounts = {
  /** Messages sent in the window. */
  totalSent: number;
  /** Recipients who pressed "report spam". */
  complained: number;
  /** Hard and soft bounces together. */
  bounced: number;
};

export type ReputationVerdict = {
  /** null when the window holds too little volume to judge. */
  complaintRate: number | null;
  bounceRate: number | null;
  level: "ok" | "warning" | "pause";
  /** Set when level is "warning" or "pause". Stored, so keep it stable. */
  reason?: string;
};

/** Percentage, rounded the way the dashboard shows it. */
export function asPercent(rate: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(rate * 100 * factor) / factor;
}

/**
 * Judge one domain's recent sending.
 *
 * Complaints outrank bounces when both are over: a complaint is a person
 * saying the mail should not have been sent, and it costs more reputation per
 * event with every mailbox provider than a bounce does.
 */
export function judge(counts: ReputationCounts): ReputationVerdict {
  if (counts.totalSent < REPUTATION_MIN_VOLUME) {
    return { complaintRate: null, bounceRate: null, level: "ok" };
  }

  const complaintRate = counts.complained / counts.totalSent;
  const bounceRate = counts.bounced / counts.totalSent;

  if (complaintRate >= COMPLAINT_PAUSE_RATE) {
    return {
      complaintRate,
      bounceRate,
      level: "pause",
      reason: `Complaint rate ${asPercent(complaintRate, 3)}% over the last ${REPUTATION_WINDOW_DAYS} days is above the ${asPercent(COMPLAINT_PAUSE_RATE, 3)}% limit`,
    };
  }

  if (bounceRate >= BOUNCE_PAUSE_RATE) {
    return {
      complaintRate,
      bounceRate,
      level: "pause",
      reason: `Bounce rate ${asPercent(bounceRate, 2)}% over the last ${REPUTATION_WINDOW_DAYS} days is above the ${asPercent(BOUNCE_PAUSE_RATE, 2)}% limit`,
    };
  }

  if (complaintRate >= COMPLAINT_WARN_RATE) {
    return {
      complaintRate,
      bounceRate,
      level: "warning",
      reason: `Complaint rate ${asPercent(complaintRate, 3)}% is above the ${asPercent(COMPLAINT_WARN_RATE, 3)}% AWS considers at risk`,
    };
  }

  if (bounceRate >= BOUNCE_WARN_RATE) {
    return {
      complaintRate,
      bounceRate,
      level: "warning",
      reason: `Bounce rate ${asPercent(bounceRate, 2)}% is above the ${asPercent(BOUNCE_WARN_RATE, 2)}% AWS considers at risk`,
    };
  }

  return { complaintRate, bounceRate, level: "ok" };
}
