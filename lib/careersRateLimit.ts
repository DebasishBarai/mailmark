/**
 * In-memory IP rate limiting for the public careers endpoints.
 *
 * Same approach as the /api/tools routes: per-instance and best-effort, which
 * is enough to stop a casual script without adding infrastructure. Determined
 * abuse is caught further down by the duplicate-application check and the
 * server-side resume validation in convex/jobApplications.ts.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Returns false when the caller is over budget. Buckets are keyed by
 * `scope:ip` so uploads and submissions are counted separately.
 */
export function allowRequest(
  scope: string,
  ip: string,
  limit: number,
  windowMs: number
): boolean {
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;

  entry.count++;
  return true;
}
