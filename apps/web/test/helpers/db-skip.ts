/**
 * Returns true when tests should SKIP because there's no local Supabase available.
 * Used with vitest's `describe.skipIf(skipIfNoLocalDb())`.
 *
 * Local dev: `npm run db:start && HAS_LOCAL_DB=1 npm test`
 * CI:        `npm test` → HAS_LOCAL_DB unset → tests skip.
 */
export function skipIfNoLocalDb(): boolean {
  return process.env.HAS_LOCAL_DB !== '1'
}

/**
 * Resolves the local Supabase JWT secret. Priority:
 *   1. process.env.SUPABASE_JWT_SECRET (explicit override, CI-friendly)
 *   2. The stable CLI default ('super-secret-jwt-token-with-at-least-32-characters-long')
 */
export function getLocalJwtSecret(): string {
  if (process.env.SUPABASE_JWT_SECRET) return process.env.SUPABASE_JWT_SECRET
  return 'super-secret-jwt-token-with-at-least-32-characters-long'
}
