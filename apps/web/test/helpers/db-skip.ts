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
 * Returns true when tests should SKIP because GoTrue (Supabase Auth) is not running.
 * Use for suites that need the live auth admin API — e.g. `auth.admin.createUser` AND
 * an adapter that internally calls `getUserById` (a hand-inserted auth.users row fails
 * GoTrue's loader, so those suites genuinely require the service, not just a DB row).
 *
 * CI starts Supabase with `--exclude gotrue` and sets SUPABASE_EXCLUDE_GOTRUE=true, so
 * these suites skip there; locally (full `supabase start`) the var is unset → they run.
 */
export function skipIfNoGoTrue(): boolean {
  return skipIfNoLocalDb() || process.env.SUPABASE_EXCLUDE_GOTRUE === 'true'
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
