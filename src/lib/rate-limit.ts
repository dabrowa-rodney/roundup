// Fixed-window rate limiting, stored in Postgres.
//
// Why the DB and not memory: this runs on serverless functions, so instances
// share no state and are created/destroyed freely — an in-process counter is
// bypassed simply by landing on a cold instance. One atomic upsert per check
// costs a single round trip and works regardless of how requests are spread.
//
// Fixed windows (rather than a sliding log) keep it to one row and one
// statement per check; the trade-off is that a caller can spend their whole
// allowance at the end of one window and again at the start of the next. That's
// fine for the abuse we're stopping (code brute-forcing, email bombing).

import { lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";

export interface RateLimitResult {
  ok: boolean;
  /** Requests used in the current window, including this one. */
  count: number;
  limit: number;
  /** When the current window ends (i.e. when it's worth retrying). */
  resetAt: Date;
}

/** Start of the fixed window containing `now` for a given window length. */
export function windowStartFor(now: Date, windowMs: number): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

/**
 * Count one hit against `bucket` and report whether it's within `limit`.
 *
 * Fails OPEN: if the counter can't be read or written we allow the request. A
 * rate limiter is a guard rail, not an authorisation check — every caller here
 * is already authenticated and authorised — so a database blip must not lock
 * legitimate users out of billing or sign-in.
 */
export async function rateLimit(
  bucket: string,
  limit: number,
  windowMs: number,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const windowStart = windowStartFor(now, windowMs);
  const resetAt = new Date(windowStart.getTime() + windowMs);
  try {
    const [row] = await db
      .insert(rateLimits)
      .values({ bucket, windowStart, count: 1 })
      .onConflictDoUpdate({
        target: [rateLimits.bucket, rateLimits.windowStart],
        // Increment server-side so concurrent hits can't read-modify-write over
        // each other.
        set: { count: sql`${rateLimits.count} + 1` },
      })
      .returning({ count: rateLimits.count });
    const count = row?.count ?? 1;
    return { ok: count <= limit, count, limit, resetAt };
  } catch {
    return { ok: true, count: 0, limit, resetAt };
  }
}

/** Delete windows that ended before `before`. Called by the lifecycle cron so
 *  the table doesn't grow without bound. */
export async function sweepRateLimits(before: Date): Promise<number> {
  try {
    const deleted = await db
      .delete(rateLimits)
      .where(lt(rateLimits.windowStart, before))
      .returning({ id: rateLimits.id });
    return deleted.length;
  } catch {
    return 0;
  }
}

/** Best-effort client IP from the proxy headers Vercel sets. */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** Seconds until the window resets — the Retry-After value for a 429. */
export function retryAfterSeconds(
  result: RateLimitResult,
  now: Date = new Date(),
): number {
  return Math.max(1, Math.ceil((result.resetAt.getTime() - now.getTime()) / 1000));
}
