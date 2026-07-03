import { describe, it, expect, afterEach, vi } from 'vitest'
import { buildCsp, buildLegacyCsp, getCspMode } from '@/lib/security/csp'

/**
 * BTF-089b — CSP builder unit tests.
 *
 * The legacy policy MUST stay byte-identical to the policy that lived in
 * `next.config.ts` before the migration (rollback target). The expected
 * strings below are hardcoded literals copied from the pre-migration
 * `next.config.ts` — do NOT "refactor" them to reuse the builder, that would
 * defeat the drift detection.
 */

const SHARED_TAIL =
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://i.ytimg.com https://*.ggpht.com https://*.googleusercontent.com https://*.public.blob.vercel-storage.com https://*.giphy.com; " +
  "font-src 'self' data:; " +
  "connect-src 'self' https://*.supabase.co https://*.supabase.in https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://challenges.cloudflare.com https://cloudflareinsights.com https://*.public.blob.vercel-storage.com https://*.giphy.com; " +
  "media-src 'self' blob: https://*.public.blob.vercel-storage.com; " +
  "frame-src https://challenges.cloudflare.com https://www.youtube.com; " +
  "object-src 'none'; " +
  "frame-ancestors 'none'; " +
  "form-action 'self'; " +
  "base-uri 'self'"

describe('buildLegacyCsp', () => {
  it('production policy is byte-identical to the pre-migration next.config.ts policy', () => {
    expect(buildLegacyCsp(false)).toBe(
      "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com; " +
        SHARED_TAIL,
    )
  })

  it('dev policy is byte-identical to the pre-migration next.config.ts policy (adds unsafe-eval)', () => {
    expect(buildLegacyCsp(true)).toBe(
      "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://static.cloudflareinsights.com; " +
        SHARED_TAIL,
    )
  })

  it('never contains a nonce source', () => {
    expect(buildLegacyCsp(false)).not.toContain("'nonce-")
    expect(buildLegacyCsp(true)).not.toContain("'nonce-")
  })
})

describe('frameAncestors parameter (embed surface)', () => {
  it("defaults to 'none' — the byte-identity tests above pin this", () => {
    expect(buildLegacyCsp(false)).toContain("frame-ancestors 'none'")
    expect(buildCsp({ nonce: 'n', isDev: false })).toContain("frame-ancestors 'none'")
  })

  it("'*' variant differs from the default ONLY in frame-ancestors (both builders)", () => {
    const diff = (a: string, b: string) => {
      const A = a.split('; ')
      const B = b.split('; ')
      expect(A.length).toBe(B.length)
      return A.filter((d, i) => d !== B[i])
    }
    expect(diff(buildLegacyCsp(false, '*'), buildLegacyCsp(false))).toEqual(['frame-ancestors *'])
    expect(
      diff(buildCsp({ nonce: 'n', isDev: false, frameAncestors: '*' }), buildCsp({ nonce: 'n', isDev: false })),
    ).toEqual(['frame-ancestors *'])
  })
})

describe('buildCsp (nonce policy)', () => {
  it('production script-src carries nonce + CSP1 fallback + allowed hosts, no unsafe-eval', () => {
    const csp = buildCsp({ nonce: 'abc123', isDev: false })
    expect(csp).toContain(
      "script-src 'self' 'nonce-abc123' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com https://pagead2.googlesyndication.com",
    )
    expect(csp).not.toContain("'unsafe-eval'")
  })

  it('dev script-src additionally allows unsafe-eval', () => {
    const csp = buildCsp({ nonce: 'abc123', isDev: true })
    expect(csp).toContain(
      "script-src 'self' 'nonce-abc123' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://static.cloudflareinsights.com https://pagead2.googlesyndication.com",
    )
  })

  it('shares every non-script directive with the legacy policy (no accidental drift)', () => {
    const nonceDirectives = buildCsp({ nonce: 'n', isDev: false })
      .split('; ')
      .filter((d) => !d.startsWith('script-src'))
    const legacyDirectives = buildLegacyCsp(false)
      .split('; ')
      .filter((d) => !d.startsWith('script-src'))
    expect(nonceDirectives).toEqual(legacyDirectives)
  })
})

describe('getCspMode', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to legacy when both flags are unset', () => {
    vi.stubEnv('CSP_NONCE_ENABLED', '')
    vi.stubEnv('CSP_NONCE_REPORT_ONLY', '')
    expect(getCspMode()).toBe('legacy')
  })

  it('returns report-only when only CSP_NONCE_REPORT_ONLY=true', () => {
    vi.stubEnv('CSP_NONCE_ENABLED', '')
    vi.stubEnv('CSP_NONCE_REPORT_ONLY', 'true')
    expect(getCspMode()).toBe('report-only')
  })

  it('returns enforced when CSP_NONCE_ENABLED=true (wins over report-only)', () => {
    vi.stubEnv('CSP_NONCE_ENABLED', 'true')
    vi.stubEnv('CSP_NONCE_REPORT_ONLY', 'true')
    expect(getCspMode()).toBe('enforced')
  })

  it('treats non-"true" values as off (fail-safe)', () => {
    vi.stubEnv('CSP_NONCE_ENABLED', '1')
    vi.stubEnv('CSP_NONCE_REPORT_ONLY', 'yes')
    expect(getCspMode()).toBe('legacy')
  })
})
