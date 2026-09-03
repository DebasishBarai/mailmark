/**
 * The message to show when a send is refused.
 *
 * Convex hands an application error to the client as a ConvexError whose
 * `data` holds the payload the server threw; its `message` is the wrapped
 * form ("[CONVEX A(ses:sendEmail)] [Request ID: ...] ..."), which is the
 * transport's business and not something to put in front of a user.
 *
 * The send path throws ConvexError precisely so the reason for a refusal
 * survives to here (see the note above sendEmail in convex/ses.ts), so read
 * `data` first and keep the plain Error branch for anything thrown before the
 * request reaches Convex, such as a failed attachment read.
 */
export function sendErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "data" in err) {
    const { data } = err as { data: unknown };
    if (typeof data === "string" && data.length > 0) return data;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
