// Gating rules for the "Retry AWS verification" action on a domain's custom
// MAIL FROM record.
//
// Shared by the domain page (which decides whether to draw the button) and by
// the action behind it (which decides whether to honour the request). Keeping
// one copy is the point: the last bug in this area was a published record and
// the check against it drifting apart, which produced a green row over a
// MAIL FROM that could never verify.

// How long to wait between retries of the same domain. Each retry restarts
// SES's own polling window from zero, so repeated clicks make verification
// slower rather than faster, and the identity management APIs are rate
// limited to roughly one request per second.
export const MAIL_FROM_RETRY_COOLDOWN_MS = 15 * 60 * 1000;

// Whether SES has stopped looking at the MAIL FROM MX.
//
// While the status is PENDING, SES polls DNS itself and a corrected record is
// picked up without anyone asking. FAILED means it gave up after 72 hours and
// will never look again, which is the only state where re-submitting the
// attributes buys anything.
export function mailFromCheckStopped(status: string | undefined): boolean {
  return status === "FAILED" || status === "TEMPORARY_FAILURE";
}

// Whether a retry is worth offering. Requires both that SES has stopped and
// that our own DNS lookup already agrees the record is correct: retrying
// against DNS that is still wrong spends another full 72 hour window.
export function canRetryMailFrom(input: {
  sesMailFromStatus?: string;
  mailFromMxVerified?: boolean;
}): boolean {
  return (
    mailFromCheckStopped(input.sesMailFromStatus) &&
    (input.mailFromMxVerified ?? false)
  );
}

// Milliseconds left on the cooldown, 0 when a retry may proceed. A domain that
// has never been retried carries no timestamp and is never held back.
export function retryCooldownRemainingMs(
  lastRetryAt: number | undefined,
  now: number
): number {
  if (!lastRetryAt) return 0;
  return Math.max(0, MAIL_FROM_RETRY_COOLDOWN_MS - (now - lastRetryAt));
}
