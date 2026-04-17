import { describe, it, expect, beforeEach } from 'vitest';
import {
  signRecentlyVerified,
  verifyRecentlyVerified,
  LGPD_VERIFY_MAX_AGE_SEC,
} from '../../../../src/lib/lgpd/verify-cookie';

describe('lgpd verify-cookie', () => {
  beforeEach(() => {
    delete process.env.LGPD_VERIFY_SECRET;
    delete process.env.CRON_SECRET;
  });

  it('sign + verify happy path (same user, fresh timestamp)', () => {
    process.env.LGPD_VERIFY_SECRET = 'test-secret-1';
    const userId = '11111111-1111-4111-8111-111111111111';
    const now = Date.now();
    const cookie = signRecentlyVerified(userId, now);
    expect(cookie.split('.')).toHaveLength(3);
    expect(verifyRecentlyVerified(cookie, userId, now)).toBe(true);
  });

  it('returns false when cookie is undefined / empty', () => {
    process.env.LGPD_VERIFY_SECRET = 'test-secret-1';
    expect(verifyRecentlyVerified(undefined, 'u1')).toBe(false);
    expect(verifyRecentlyVerified('', 'u1')).toBe(false);
    expect(verifyRecentlyVerified(null, 'u1')).toBe(false);
  });

  it('returns false when userId mismatches', () => {
    process.env.LGPD_VERIFY_SECRET = 'test-secret-2';
    const cookie = signRecentlyVerified('user-a');
    expect(verifyRecentlyVerified(cookie, 'user-b')).toBe(false);
  });

  it('returns false when the cookie has expired (> 300s)', () => {
    process.env.LGPD_VERIFY_SECRET = 'test-secret-3';
    const userId = 'u1';
    const oldMs = Date.now() - (LGPD_VERIFY_MAX_AGE_SEC + 10) * 1000;
    const cookie = signRecentlyVerified(userId, oldMs);
    expect(verifyRecentlyVerified(cookie, userId)).toBe(false);
  });

  it('returns false when the cookie ts is in the future (clock skew / forgery)', () => {
    process.env.LGPD_VERIFY_SECRET = 'test-secret-3b';
    const userId = 'u1';
    const futureMs = Date.now() + 120 * 1000;
    const cookie = signRecentlyVerified(userId, futureMs);
    // "now" is earlier → negative age → rejected.
    expect(verifyRecentlyVerified(cookie, userId, Date.now())).toBe(false);
  });

  it('returns false when the HMAC has been tampered with', () => {
    process.env.LGPD_VERIFY_SECRET = 'test-secret-4';
    const cookie = signRecentlyVerified('u1');
    const parts = cookie.split('.');
    // Flip one hex char in the MAC.
    const flipped = parts[2]!.startsWith('0')
      ? '1' + parts[2]!.slice(1)
      : '0' + parts[2]!.slice(1);
    const tampered = `${parts[0]}.${parts[1]}.${flipped}`;
    expect(verifyRecentlyVerified(tampered, 'u1')).toBe(false);
  });

  it('returns false when the cookie payload has been swapped (userId rebinding)', () => {
    process.env.LGPD_VERIFY_SECRET = 'test-secret-5';
    const cookie = signRecentlyVerified('user-a');
    const parts = cookie.split('.');
    // Attacker swaps userId but keeps old MAC — should not verify.
    const swapped = `user-b.${parts[1]}.${parts[2]}`;
    expect(verifyRecentlyVerified(swapped, 'user-b')).toBe(false);
  });

  it('returns false when LGPD_VERIFY_SECRET / CRON_SECRET are both unset', () => {
    // Verifier must NOT accept anything if it can't derive a secret —
    // otherwise an attacker could force a "no secret" path. The cookie
    // was signed separately below using a known secret, but verify
    // reads env fresh and gets '' → fails.
    process.env.LGPD_VERIFY_SECRET = 'temp';
    const cookie = signRecentlyVerified('u1');
    delete process.env.LGPD_VERIFY_SECRET;
    delete process.env.CRON_SECRET;
    expect(verifyRecentlyVerified(cookie, 'u1')).toBe(false);
  });

  it('falls back to CRON_SECRET when LGPD_VERIFY_SECRET is empty', () => {
    delete process.env.LGPD_VERIFY_SECRET;
    process.env.CRON_SECRET = 'fallback-secret';
    const cookie = signRecentlyVerified('u1');
    expect(verifyRecentlyVerified(cookie, 'u1')).toBe(true);
  });

  it('signRecentlyVerified throws when no secret is configured', () => {
    delete process.env.LGPD_VERIFY_SECRET;
    delete process.env.CRON_SECRET;
    expect(() => signRecentlyVerified('u1')).toThrow(/LGPD_VERIFY_SECRET/);
  });

  it('rejects malformed cookies (wrong number of parts)', () => {
    process.env.LGPD_VERIFY_SECRET = 'x';
    expect(verifyRecentlyVerified('u1.123', 'u1')).toBe(false);
    expect(verifyRecentlyVerified('u1.123.abc.extra', 'u1')).toBe(false);
  });
});
