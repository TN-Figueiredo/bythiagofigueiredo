import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * "Recently verified" cookie — proves the current session passed a live
 * password re-auth within the last `MAX_AGE_SEC` seconds. Read by
 * high-risk LGPD endpoints (request-deletion, request-export) so a leaked
 * session cookie alone isn't enough to delete / exfiltrate user data.
 *
 * Cookie value format: `${userId}.${timestamp}.${hmac}`
 *   - `userId`: the auth.users.id the cookie was issued to
 *   - `timestamp`: unix epoch seconds at issue time
 *   - `hmac`: HMAC-SHA256 of `"${userId}.${timestamp}"` using LGPD_VERIFY_SECRET
 *
 * HTTPOnly + secure + sameSite=strict + maxAge=300 is set on the cookie
 * at the route layer — this module is just the format + verify.
 *
 * Fix 14 (Sprint 5a): previously password verify only returned a JSON
 * flag the client held — any client-side bypass meant no real protection.
 */

export const LGPD_VERIFY_COOKIE_NAME = 'lgpd_recently_verified';
export const LGPD_VERIFY_MAX_AGE_SEC = 300; // 5 minutes

function getSecret(): string {
  const secret =
    process.env.LGPD_VERIFY_SECRET || process.env.CRON_SECRET || '';
  if (!secret) {
    // Fail loudly — silent fallback would let the cookie be forged with
    // `HMAC(key='')`, which is trivially computable. Callers must set the
    // env var in every environment (dev, preview, prod).
    throw new Error(
      'LGPD_VERIFY_SECRET (or CRON_SECRET fallback) is not set — password re-auth cannot be enforced',
    );
  }
  return secret;
}

function hmacHex(input: string, secret: string): string {
  return createHmac('sha256', secret).update(input).digest('hex');
}

/**
 * Produce a signed cookie value binding `userId` to the current time.
 * Caller sets the cookie with httpOnly/secure/sameSite='strict'/maxAge=300.
 */
export function signRecentlyVerified(
  userId: string,
  now: number = Date.now(),
): string {
  if (!userId) {
    throw new Error('signRecentlyVerified: userId is required');
  }
  const secret = getSecret();
  const ts = Math.floor(now / 1000);
  const payload = `${userId}.${ts}`;
  const mac = hmacHex(payload, secret);
  return `${payload}.${mac}`;
}

/**
 * Returns true iff:
 *   - cookie is present and well-formed (3 dot-separated parts)
 *   - HMAC matches the payload (constant-time compare)
 *   - timestamp is within the last `LGPD_VERIFY_MAX_AGE_SEC` seconds
 *   - userId embedded in the cookie equals the supplied `userId`
 *
 * Any parse / env / crypto failure → false (never throws to callers).
 */
export function verifyRecentlyVerified(
  cookie: string | undefined | null,
  userId: string,
  now: number = Date.now(),
): boolean {
  if (!cookie || !userId) return false;
  const parts = cookie.split('.');
  if (parts.length !== 3) return false;
  const [rawId, rawTs, rawMac] = parts as [string, string, string];
  if (!rawId || !rawTs || !rawMac) return false;
  if (rawId !== userId) return false;

  const ts = Number.parseInt(rawTs, 10);
  if (!Number.isFinite(ts) || ts <= 0) return false;
  const ageSec = Math.floor(now / 1000) - ts;
  if (ageSec < 0 || ageSec > LGPD_VERIFY_MAX_AGE_SEC) return false;

  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return false;
  }
  const expected = hmacHex(`${rawId}.${rawTs}`, secret);

  // Constant-time compare. Both sides are hex strings of equal length;
  // Buffer.byteLength on hex will be half the char-length → equal.
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(rawMac, 'hex');
  if (a.length === 0 || a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
