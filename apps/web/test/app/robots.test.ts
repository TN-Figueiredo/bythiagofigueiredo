import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Sprint 5b PR-B Phase 3 — `app/robots.ts` (Node runtime, force-dynamic).
 *
 * Contract:
 *   - preview/dev host → `Disallow: /`
 *   - prod host → `Allow: /` + `Disallow: <PROTECTED_DISALLOW_PATHS>` +
 *     `Sitemap: ${siteUrl}/sitemap.xml`
 *   - `SEO_AI_CRAWLERS_BLOCKED=true` flag adds AI-crawler disallow rules
 *     (verified via robots-config unit tests; this suite only checks the
 *     flag is wired through)
 */
describe('app/robots.ts', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllEnvs())

  it('returns Disallow:/ for preview hosts', async () => {
    vi.doMock('next/headers', () => ({
      headers: async () => new Map([['host', 'dev.bythiagofigueiredo.com']]),
    }))
    const { default: robots } = await import('@/app/robots')
    const r = await robots()
    expect(r.rules).toEqual([{ userAgent: '*', disallow: '/' }])
  })

  it('emits Allow:/ + Disallow + Sitemap on prod', async () => {
    vi.doMock('next/headers', () => ({
      headers: async () => new Map([['host', 'bythiagofigueiredo.com']]),
    }))
    vi.doMock('@/lib/seo/host', () => ({
      isPreviewOrDevHost: () => false,
      resolveSiteByHost: vi
        .fn()
        .mockResolvedValue({ id: 'site-1', slug: 'bythiagofigueiredo' }),
    }))
    vi.doMock('@/lib/seo/config', () => ({
      getSiteSeoConfig: vi
        .fn()
        .mockResolvedValue({ siteUrl: 'https://bythiagofigueiredo.com' }),
    }))
    const { default: robots } = await import('@/app/robots')
    const r = await robots()
    const main = (r.rules as Array<{ userAgent: string; allow?: string; disallow?: string[] }>).find(
      (rule) => rule.userAgent === '*',
    )
    expect(main?.allow).toBe('/')
    expect(main?.disallow).toEqual(
      expect.arrayContaining(['/admin', '/cms', '/account', '/api']),
    )
    expect(r.sitemap).toBe('https://bythiagofigueiredo.com/sitemap.xml')
  })

  it('falls back to https://${host}/sitemap.xml when site config unavailable', async () => {
    vi.doMock('next/headers', () => ({
      headers: async () => new Map([['host', 'newdomain.test']]),
    }))
    vi.doMock('@/lib/seo/host', () => ({
      isPreviewOrDevHost: () => false,
      resolveSiteByHost: vi.fn().mockResolvedValue(null),
    }))
    const { default: robots } = await import('@/app/robots')
    const r = await robots()
    expect(r.sitemap).toBe('https://newdomain.test/sitemap.xml')
    // Still emits the default-deny scaffold (Allow:/ + protected paths) even
    // without site config so an unknown prod host doesn't accidentally crawl
    // the staff areas.
    const main = (r.rules as Array<{ userAgent: string; allow?: string; disallow?: string[] }>).find(
      (rule) => rule.userAgent === '*',
    )
    expect(main?.allow).toBe('/')
    expect(main?.disallow).toEqual(
      expect.arrayContaining(['/admin', '/cms', '/account', '/api']),
    )
  })

  it('adds AI-crawler disallow rules when SEO_AI_CRAWLERS_BLOCKED=true', async () => {
    vi.stubEnv('SEO_AI_CRAWLERS_BLOCKED', 'true')
    vi.doMock('next/headers', () => ({
      headers: async () => new Map([['host', 'bythiagofigueiredo.com']]),
    }))
    vi.doMock('@/lib/seo/host', () => ({
      isPreviewOrDevHost: () => false,
      resolveSiteByHost: vi
        .fn()
        .mockResolvedValue({ id: 'site-1', slug: 'bythiagofigueiredo' }),
    }))
    vi.doMock('@/lib/seo/config', () => ({
      getSiteSeoConfig: vi
        .fn()
        .mockResolvedValue({ siteUrl: 'https://bythiagofigueiredo.com' }),
    }))
    const { default: robots } = await import('@/app/robots')
    const r = await robots()
    const agents = (r.rules as Array<{ userAgent: string }>).map((x) => x.userAgent)
    expect(agents).toEqual(expect.arrayContaining(['GPTBot', 'CCBot', 'ClaudeBot']))
  })
})
