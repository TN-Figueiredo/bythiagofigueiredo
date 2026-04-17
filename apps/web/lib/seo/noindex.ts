/**
 * Paths that MUST emit `<meta name="robots" content="noindex,nofollow">` AND
 * appear as `Disallow:` lines in robots.txt. Single source of truth consumed
 * by both page metadata factories and robots route handler.
 */
export const PROTECTED_DISALLOW_PATHS: readonly string[] = [
  '/admin',
  '/cms',
  '/account',
  '/api',
  '/newsletter/confirm',
  '/unsubscribe',
  '/lgpd/confirm',
  '/site-error',
  '/site-not-configured',
  '/cms/disabled',
  '/signup/invite',
  '/auth',
]

export function isPathIndexable(pathname: string): boolean {
  return !PROTECTED_DISALLOW_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
