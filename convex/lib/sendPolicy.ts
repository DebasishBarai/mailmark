/**
 * The one place send eligibility policy is decided.
 *
 * Every path that reaches SES asks convex/sendGate.ts for a verdict, and
 * sendGate asks this module. Nothing else is allowed to have an opinion about
 * whether an address may be mailed, so changing a rule here changes it
 * everywhere, including the paths nobody remembered to update.
 *
 * Defaults live in code; the sendingControls row may override the three that
 * an operator plausibly needs to change during an incident, without a deploy.
 */

// ── Verification staleness ──
//
// Contact data decays at roughly 2% a month. A verification is therefore a
// measurement with an age, not a boolean: at 90 days a result carries about a
// 6% chance of being wrong, which is already larger than the 5% bounce rate
// that gets an SES account suspended. Ninety days is the point where
// re-verifying costs less than the reputation damage of trusting it, given
// bulk verification is fractions of a cent per address.
export const VERIFICATION_TTL_DAYS = 90;
export const VERIFICATION_TTL_MS = VERIFICATION_TTL_DAYS * 24 * 60 * 60 * 1000;

// ── What each MillionVerifier verdict means for a send ──
//
// invalid and disposable are unambiguous: the mailbox does not accept mail, or
// it is a throwaway that will never read it. Both block, and both are strong
// enough to write a suppression row so we stop paying to rediscover them.
//
// catch_all and unknown are the real decision, and it drives most of the
// outcome here because most of this list is corporate domains that answer
// catch-all:
//
//   catch_all — the domain's mail server accepts every address at SMTP time,
//   so no verifier on earth can tell a real mailbox from a typo. Blocking it
//   would discard most of the 22,024 queued addresses, the overwhelming
//   majority of which are real employees at real companies; the campaign would
//   effectively be cancelled to avoid a risk we have not measured. Allowing it
//   means some share of catch-all addresses bounce. We allow, because the
//   suppression list is the better instrument for this: a catch-all domain's
//   dead addresses announce themselves on first send as hard bounces, are
//   suppressed permanently, and never cost us a second bounce. That converts
//   an unbounded ongoing risk into a one-off cost per bad address.
//
//   unknown — the verifier could not finish (greylisting, timeout, the server
//   refused to talk). It is evidence of nothing, and it is a small share of any
//   list. Allowing it keeps a temporarily grumpy mail server from permanently
//   costing us its whole domain.
//
// The tradeoff is deliberate and it is the lever to pull first if the bounce
// rate climbs toward 5%: flipping catchAllPolicy to "block" in the
// sendingControls row cuts bounces hard and cuts volume harder, with no deploy.
export type VerificationResult =
  | "ok"
  | "catch_all"
  | "unknown"
  | "invalid"
  | "disposable"
  | "error";

export type Decision = "allow" | "block" | "hold";

export const DEFAULT_CATCH_ALL_POLICY: "allow" | "block" = "allow";
export const DEFAULT_UNKNOWN_POLICY: "allow" | "block" = "allow";

// ── What to do when MillionVerifier cannot answer at all ──
//
// The brief is in two minds about this, and the disagreement is worth stating
// rather than silently resolving: goal 4 is titled "Fail closed" and the
// acceptance criteria say "an API outage holds sends rather than releasing
// them", but goal 4's body says to proceed with the send and never hold a
// message because a check could not be completed.
//
// "hold" is the reading that satisfies both the title and the acceptance
// criterion, and it is a third thing rather than a compromise: a held message
// is neither sent nor blocked, it is re-armed to try again later. Nothing is
// lost, and nothing goes out unverified during an outage. It is the default.
//
// A hold is bounded by MAX_HOLDS. A message that has been held that many times
// is marked blocked with reason "verifier_unavailable" so it surfaces as a
// problem instead of quietly cycling forever. Set onVerifierUnavailable to
// "send" in the sendingControls row for the other reading, which trades bounce
// risk for throughput during an outage.
export const DEFAULT_ON_VERIFIER_UNAVAILABLE: "hold" | "send" = "hold";

// How long a held message waits before trying again, and how many times.
//
// Ten minutes times 144 is twenty-four hours. The ceiling has to survive the
// backfill, not just a rate-limit window: while 22,024 queued addresses are
// being verified in bulk, a message whose send time arrives before its own
// address has been reached will hold, and a two hour ceiling would turn that
// ordinary timing into a permanently blocked message. A day is long enough for
// a bulk file to land and for a human to notice an outage.
//
// Messages that do exhaust the ceiling are recoverable: they become blocked
// rows with reason "verifier_unavailable", and ses.requeueBlockedByVerifier
// re-arms them. Nothing is lost either way.
export const HOLD_RETRY_MS = 10 * 60 * 1000;
export const MAX_HOLDS = 144;

// ── Block reasons ──
//
// Written to sendBlocks.reason and emails.blockReason. Stable strings: they
// are queried on and shown in the dashboard.
export const BLOCK_REASONS = {
  suppressedHardBounce: "suppressed_hard_bounce",
  suppressedComplaint: "suppressed_complaint",
  suppressedManual: "suppressed_manual",
  unsubscribed: "unsubscribed",
  invalidAddress: "invalid_address",
  disposableAddress: "disposable_address",
  catchAllBlocked: "catch_all_blocked",
  unknownBlocked: "unknown_blocked",
  malformedAddress: "malformed_address",
  verifierUnavailable: "verifier_unavailable",
  // Distinct from the above on purpose. An unreachable API is an incident; an
  // unset MILLIONVERIFIER_API_KEY is a deploy that forgot a step, and the two
  // want completely different responses. Reading "verifier_unavailable" while
  // MillionVerifier is perfectly healthy has sent people hunting in the wrong
  // place before.
  verifierNotConfigured: "verifier_not_configured",
} as const;

export const HOLD_REASONS = {
  sendingPaused: "sending_paused",
  awaitingVerification: "awaiting_verification",
  verifierUnavailable: "verifier_unavailable",
  verifierNotConfigured: "verifier_not_configured",
} as const;

/**
 * The same reasons in words, for showing someone.
 *
 * The codes above are stable because they are stored and queried on; this is
 * the layer that keeps them out of the compose window, which was reporting
 * refusals as "tom@example.com: invalid_address". A code is a fine thing to
 * write to sendBlocks and a poor thing to hand a person mid-send.
 *
 * Phrased to complete "<address>: ...", and to say what the sender can act on:
 * a catch-all or unknown verdict is a policy choice they can change in
 * settings, while an invalid address is not.
 */
const REASON_TEXT: Record<string, string> = {
  [BLOCK_REASONS.suppressedHardBounce]: "previously hard bounced",
  [BLOCK_REASONS.suppressedComplaint]: "reported an earlier message as spam",
  [BLOCK_REASONS.suppressedManual]: "on your suppression list",
  [BLOCK_REASONS.unsubscribed]: "unsubscribed",
  [BLOCK_REASONS.invalidAddress]: "invalid address",
  [BLOCK_REASONS.disposableAddress]: "disposable address",
  [BLOCK_REASONS.catchAllBlocked]:
    "catch-all domain, which your sending policy blocks",
  [BLOCK_REASONS.unknownBlocked]:
    "could not be confirmed, and your sending policy blocks unconfirmed addresses",
  [BLOCK_REASONS.malformedAddress]: "not a valid email address",
  [BLOCK_REASONS.verifierUnavailable]: "the verifier could not be reached",
  [BLOCK_REASONS.verifierNotConfigured]: "the verifier is not configured",
  [HOLD_REASONS.sendingPaused]: "sending is paused",
  [HOLD_REASONS.awaitingVerification]: "still being verified",
};

/**
 * Wording for one reason code, falling back to the code itself.
 *
 * The fallback matters: a reason added to BLOCK_REASONS without a line here
 * should read awkwardly, not disappear from the message.
 */
export function describeReason(reason: string): string {
  return REASON_TEXT[reason] ?? reason;
}

/** Runtime overrides read from the sendingControls row. */
export type PolicyOverrides = {
  catchAllPolicy?: "allow" | "block";
  unknownPolicy?: "allow" | "block";
  onVerifierUnavailable?: "hold" | "send";
  verificationTtlDays?: number;
};

export type EffectivePolicy = {
  catchAllPolicy: "allow" | "block";
  unknownPolicy: "allow" | "block";
  onVerifierUnavailable: "hold" | "send";
  verificationTtlMs: number;
};

export function effectivePolicy(overrides?: PolicyOverrides): EffectivePolicy {
  return {
    catchAllPolicy: overrides?.catchAllPolicy ?? DEFAULT_CATCH_ALL_POLICY,
    unknownPolicy: overrides?.unknownPolicy ?? DEFAULT_UNKNOWN_POLICY,
    onVerifierUnavailable:
      overrides?.onVerifierUnavailable ?? DEFAULT_ON_VERIFIER_UNAVAILABLE,
    verificationTtlMs:
      (overrides?.verificationTtlDays ?? VERIFICATION_TTL_DAYS) *
      24 *
      60 *
      60 *
      1000,
  };
}

/**
 * Turn a verification verdict into a send decision.
 *
 * "error" is a lookup we could not complete, which is the outage case above,
 * not a statement about the address.
 */
export function decideForResult(
  result: VerificationResult,
  policy: EffectivePolicy
): { decision: Decision; reason?: string } {
  switch (result) {
    case "ok":
      return { decision: "allow" };
    case "invalid":
      return { decision: "block", reason: BLOCK_REASONS.invalidAddress };
    case "disposable":
      return { decision: "block", reason: BLOCK_REASONS.disposableAddress };
    case "catch_all":
      return policy.catchAllPolicy === "allow"
        ? { decision: "allow" }
        : { decision: "block", reason: BLOCK_REASONS.catchAllBlocked };
    case "unknown":
      return policy.unknownPolicy === "allow"
        ? { decision: "allow" }
        : { decision: "block", reason: BLOCK_REASONS.unknownBlocked };
    case "error":
      return policy.onVerifierUnavailable === "send"
        ? { decision: "allow" }
        : { decision: "hold", reason: HOLD_REASONS.verifierUnavailable };
  }
}

/**
 * MillionVerifier subresults that describe a temporary condition rather than a
 * dead mailbox.
 *
 * Drawn from the documented Subresult enum. Every one of them can appear on an
 * address that is perfectly real: a full mailbox empties, a greylisting server
 * relents, a timeout was our side of the connection, an anti-spam system was
 * having a bad day. Suppressing on any of them would permanently discard a
 * valid recipient, which is the same mistake as suppressing on a transient
 * SES bounce.
 */
const TRANSIENT_SUBRESULTS = new Set([
  "internal_error",
  "no_local_ip_available",
  "dns_server_failed",
  "dns_error",
  "dns_refused",
  "could_not_connect",
  "connection_lost",
  "connection_timeout",
  "connection_refused",
  "connection_reset_by_peer",
  "connection_no_route_to_host",
  "timeout_error",
  "mailbox_full",
  "greylisted",
  "ip_blocked",
  "anti_spam_system",
  "mail_service_unavailable",
  "host_not_accept_incoming_mail",
  "no_code_in_banner",
  "invalid_banner_code",
  "no_code_in_ehlo_response",
  "no_code_in_helo_response",
  "no_code_in_mail_from_response",
  "no_code_in_rcpt_to_response",
  "unknown",
]);

/**
 * Which verification results are worth remembering as a suppression.
 *
 * An invalid or disposable address is invalid for everybody, so paying to
 * rediscover it on every campaign is waste. Suppression rows are per-user
 * though, so this only writes one for the account that tried to send.
 *
 * The subresult is consulted because "invalid" is not always a statement about
 * the mailbox. MillionVerifier can return invalid with a subresult of
 * mailbox_full, greylisted or connection_timeout, none of which proves the
 * address does not exist. Those still *block* the send - the verdict is the
 * verdict - but they must not become a permanent suppression, or a server
 * having a bad afternoon costs us the address forever.
 */
export function suppressionReasonForResult(
  result: VerificationResult,
  subResult?: string
): "invalid" | "disposable" | null {
  if (subResult && TRANSIENT_SUBRESULTS.has(subResult.toLowerCase())) {
    return null;
  }
  if (result === "invalid") return "invalid";
  if (result === "disposable") return "disposable";
  return null;
}

/**
 * Whether an SES bounce is permanent enough to suppress the address forever.
 *
 * Permanent means the mailbox does not exist or the domain refuses us
 * outright. Transient means full mailbox, greylisting, or a server having a
 * bad day: those say nothing about whether the address is real, and
 * suppressing on them would throw away valid recipients. Undetermined is SES
 * saying it could not classify, which is not evidence either.
 */
export function isPermanentBounce(bounceType?: string): boolean {
  return bounceType === "Permanent";
}

/**
 * A syntax gate that runs before any paid lookup.
 *
 * Deliberately permissive: it rejects what cannot be an address at all rather
 * than trying to enforce RFC 5321, because a strict regex here would refuse
 * legitimate addresses and we have a verifier for the real question.
 */
export function isPlausibleAddress(email: string): boolean {
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 320) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}

export function normalizeAddress(email: string): string {
  return email.trim().toLowerCase();
}
