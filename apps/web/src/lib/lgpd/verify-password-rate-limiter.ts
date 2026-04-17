import { InMemoryRateLimiter } from '@tn-figueiredo/audit';

/**
 * P1-5 (Sprint 5a): module-scoped rate limiter singleton shared by
 * `/api/auth/verify-password`. Lives outside the route file because
 * Next.js rejects any non-handler export from `route.ts` at build time.
 *
 * 5 attempts per user per hour. Cold starts reset the window — acceptable
 * in serverless, since session-cookie theft already implies broader
 * compromise; the per-invocation cap still blocks high-rate brute force.
 *
 * Tests import this module and call `_store.clear()` via `beforeEach`
 * to avoid counter leak between suites.
 */
export const verifyPasswordRateLimiter = new InMemoryRateLimiter();
