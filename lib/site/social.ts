/**
 * Mailmark's own social accounts.
 *
 * The footer read these straight from NEXT_PUBLIC_ env vars, which renders
 * href="undefined" on any deployment that does not set them, and the contact
 * page carried a placeholder "#" instead. One constant each, with the real
 * account as the fallback, so an unset variable degrades to the right link
 * rather than a broken one, and both places agree.
 */

export const X_URL = process.env.NEXT_PUBLIC_X_URL || "https://x.com/mailmarkdev";
export const X_HANDLE = "@mailmarkdev";
