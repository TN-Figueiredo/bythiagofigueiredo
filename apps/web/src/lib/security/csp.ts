/**
 * BTF-089b — Content-Security-Policy builders.
 *
 * The global CSP used to live in `next.config.ts` (`headers()` → `/:path*`).
 * It now lives here and is emitted by `src/middleware.ts` on every response,
 * which is what makes the nonce-based policy possible: the middleware
 * generates a fresh nonce per request, injects it into the *request* headers
 * (`x-nonce` + `content-security-policy`) so Next.js tags its own inline
 * bootstrap/hydration scripts with it, and mirrors the policy on the
 * *response* header for the browser.
 *
 * Rollout is staged behind two env flags (see `getCspMode()`):
 *
 * 1. default (both unset)          → legacy policy enforced (byte-identical
 *                                    to the pre-migration `next.config.ts`
 *                                    policy). Trivial rollback target.
 * 2. `CSP_NONCE_REPORT_ONLY=true`  → legacy policy stays enforced AND the
 *                                    nonce policy is emitted as
 *                                    `Content-Security-Policy-Report-Only`.
 *                                    Browsers report (but do not block)
 *                                    violations — the observation stage.
 * 3. `CSP_NONCE_ENABLED=true`      → nonce policy enforced, report-only off.
 *
 * NEVER emit two *enforced* CSPs at once: browsers apply the intersection,
 * so a stray legacy header alongside the nonce header would re-tighten the
 * policy unpredictably. The middleware sets the enforced header exactly once.
 */

export type CspMode = 'legacy' | 'report-only' | 'enforced'

/** Resolve the rollout stage from env. `CSP_NONCE_ENABLED` wins. */
export function getCspMode(): CspMode {
  if (process.env.CSP_NONCE_ENABLED === 'true') return 'enforced'
  if (process.env.CSP_NONCE_REPORT_ONLY === 'true') return 'report-only'
  return 'legacy'
}

/**
 * Directives shared verbatim by the legacy and nonce policies.
 * Order matters for the legacy byte-identity guarantee — do not reorder.
 */
function sharedDirectives(): string[] {
  return [
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://i.ytimg.com https://*.ggpht.com https://*.googleusercontent.com https://*.public.blob.vercel-storage.com https://*.giphy.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://*.supabase.in https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://challenges.cloudflare.com https://cloudflareinsights.com https://*.public.blob.vercel-storage.com https://*.giphy.com",
    "media-src 'self' blob: https://*.public.blob.vercel-storage.com",
    "frame-src https://challenges.cloudflare.com https://www.youtube.com",
    // object-src 'none' blocks <object>/<embed>/<applet> — a classic XSS /
    // plugin vector. Zero hydration impact: Next never emits these.
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
  ]
}

/**
 * Pre-migration policy, byte-identical to the string `next.config.ts` used
 * to emit for `/:path*` (guarded by a unit test). Kept as the default and
 * as the trivially-safe rollback while the nonce policy is rolled out.
 *
 * `script-src` keeps `'unsafe-inline'` because without a nonce the Next.js
 * App Router inline bootstrap/hydration scripts would be blocked.
 * `'unsafe-eval'` is required by Next.js in development only (hot reload /
 * source maps) and MUST NOT ship to production.
 */
export function buildLegacyCsp(isDev: boolean): string {
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://static.cloudflareinsights.com"
    : "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com"
  return ["default-src 'self'", scriptSrc, ...sharedDirectives()].join('; ')
}

/**
 * Nonce-based policy (BTF-089b).
 *
 * `script-src` notes:
 * - `'nonce-{n}'` — only scripts carrying this per-request nonce execute in
 *   CSP3 browsers. Next.js injects it into its own inline scripts because the
 *   middleware sets the policy on the *request* `content-security-policy`
 *   header before delegating.
 * - `'unsafe-inline'` — CSP1/2 fallback ONLY: per spec, browsers that
 *   understand nonces IGNORE 'unsafe-inline' when a nonce or hash source is
 *   present. Ancient browsers without nonce support keep working instead of
 *   hard-breaking hydration.
 * - `https://pagead2.googlesyndication.com` — Google AdSense loader
 *   (`<AdProviders>`). Its absence from the legacy policy was a pre-existing
 *   bug (the script would be blocked the day `AD_GOOGLE_ENABLED` ships);
 *   fixed here rather than back-ported to keep the legacy policy
 *   byte-identical for rollback comparison.
 * - dev additionally needs `'unsafe-eval'` (hot reload / source maps).
 */
export function buildCsp({ nonce, isDev }: { nonce: string; isDev: boolean }): string {
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://static.cloudflareinsights.com https://pagead2.googlesyndication.com`
    : `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com https://pagead2.googlesyndication.com`
  return ["default-src 'self'", scriptSrc, ...sharedDirectives()].join('; ')
}
