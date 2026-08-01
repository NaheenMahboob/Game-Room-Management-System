/**
 * In-memory sliding-window rate limiter for sensitive endpoints (login).
 *
 * Suitable for a single Node process. Multi-instance deploys would need a
 * shared store (Redis); for a mosque on-prem deploy this is enough.
 */

type RateBucket = {
  /** Failed attempts counted in the current window. */
  count: number;
  /** Epoch ms when the window resets and the bucket is cleared. */
  resetAt: number;
};

/** Max failed attempts allowed per key within one window. */
export const LOGIN_RATE_LIMIT_MAX = 5;

/** Window length for login attempts (15 minutes). */
export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const buckets = new Map<string, RateBucket>();

/**
 * Result of checking whether a key may proceed.
 */
export type RateLimitCheck = {
  allowed: boolean;
  /** Seconds until the window resets when blocked; otherwise `0`. */
  retryAfterSec: number;
  remaining: number;
};

/**
 * Inspects (and lazily expires) the bucket for `key` without incrementing.
 *
 * @param key - Namespaced key such as `login:ip:1.2.3.4`
 * @param max - Maximum attempts allowed in the window
 * @param windowMs - Window duration in milliseconds
 */
export function checkRateLimit(
  key: string,
  max = LOGIN_RATE_LIMIT_MAX,
  windowMs = LOGIN_RATE_LIMIT_WINDOW_MS
): RateLimitCheck {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    return { allowed: true, retryAfterSec: 0, remaining: max };
  }

  if (bucket.count >= max) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((bucket.resetAt - now) / 1000)
    );
    return { allowed: false, retryAfterSec, remaining: 0 };
  }

  return {
    allowed: true,
    retryAfterSec: 0,
    remaining: Math.max(0, max - bucket.count),
  };
}

/**
 * Records a failed attempt against `key`, starting a new window if needed.
 *
 * @param key - Namespaced rate-limit key
 * @param windowMs - Window duration in milliseconds
 */
export function recordRateLimitHit(
  key: string,
  windowMs = LOGIN_RATE_LIMIT_WINDOW_MS
): void {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  existing.count += 1;
}

/**
 * Clears the bucket for `key` (e.g. after a successful login).
 *
 * @param key - Namespaced rate-limit key
 */
export function clearRateLimit(key: string): void {
  buckets.delete(key);
}

/**
 * Builds the login rate-limit key for a client IP.
 *
 * @param ip - Client IP or `"unknown"`
 */
export function loginIpKey(ip: string): string {
  return `login:ip:${ip}`;
}

/**
 * Builds the login rate-limit key for an email address.
 *
 * @param email - Normalized (lowercased) email
 */
export function loginEmailKey(email: string): string {
  return `login:email:${email.toLowerCase()}`;
}
