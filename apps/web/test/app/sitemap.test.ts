import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Sprint 5b PR-B Phase 3 — `app/sitemap.ts` (Node runtime, force-dynamic).
 *
 * Contract:
 *   - preview/dev host → []
 *   - host resolves to null site → []
 *   - maps `SitemapRouteEntry[]` to `MetadataRoute.Sitemap[]` with absolute
 *     URLs + per-locale `alternates.languages` including `x-default` pointing
 *     at the default-locale alternate.
 *
 * Tests use `vi.resetModules()` + `vi.doMock()` per-case to avoid cache
 * collision (module-level caches survive across tests otherwise).
 */
describe('app/sitemap.ts', () => {
  beforeEach(() => vi.resetModules())

  it('returns [] for preview/dev hosts', async () => {
    vi.doMock('next/headers', () => ({
      headers: async () => new Map([['host', 'dev.bythiagofigueiredo.com']]),
    }))
    const { default: sitemap } = await import('@/app/sitemap')
    expect(await sitemap()).toEqual([])
  })

  it('returns [] when site not resolved', async () => {
    vi.doMock('next/headers', () => ({
      headers: async () => new Map([['host', 'unknown.test']]),
    }))
    vi.doMock('@/lib/seo/host', () => ({
      isPreviewOrDevHost: () => false,
      resolveSiteByHost: vi.fn().mockResolvedValue(null),
    }))
    const { default: sitemap } = await import('@/app/sitemap')
    expect(await sitemap()).toEqual([])
  })

  it('maps enumerator routes to MetadataRoute.Sitemap with absolute URLs + alternates (including x-default)', async () => {
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
      getSiteSeoConfig: vi.fn().mockResolvedValue({
        siteUrl: 'https://bythiagofigueiredo.com',
        defaultLocale: 'pt-BR',
        supportedLocales: ['pt-BR', 'en'],
      }),
    }))
    vi.doMock('@/lib/seo/enumerator', () => ({
      enumerateSiteRoutes: vi.fn().mockResolvedValue([
        {
          path: '/blog/pt-BR/x',
          lastModified: new Date('2026-04-15T00:00:00Z'),
          alternates: { 'pt-BR': '/blog/pt-BR/x', en: '/blog/en/x' },
          changeFrequency: 'weekly',
          priority: 0.7,
        },
      ]),
    }))
    const { default: sitemap } = await import('@/app/sitemap')
    const result = await sitemap()
    expect(result).toHaveLength(1)
    expect(result[0]?.url).toBe('https://bythiagofigueiredo.com/blog/pt-BR/x')
    expect(result[0]?.alternates?.languages).toMatchObject({
      'pt-BR': 'https://bythiagofigueiredo.com/blog/pt-BR/x',
      en: 'https://bythiagofigueiredo.com/blog/en/x',
      'x-default': 'https://bythiagofigueiredo.com/blog/pt-BR/x',
    })
    expect(result[0]?.changeFrequency).toBe('weekly')
    expect(result[0]?.priority).toBe(0.7)
  })

  it('omits alternates key when entry has none', async () => {
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
      getSiteSeoConfig: vi.fn().mockResolvedValue({
        siteUrl: 'https://bythiagofigueiredo.com',
        defaultLocale: 'pt-BR',
        supportedLocales: ['pt-BR', 'en'],
      }),
    }))
    vi.doMock('@/lib/seo/enumerator', () => ({
      enumerateSiteRoutes: vi.fn().mockResolvedValue([
        {
          path: '/privacy',
          lastModified: new Date('2026-04-15T00:00:00Z'),
          alternates: {},
          changeFrequency: 'yearly',
          priority: 0.3,
        },
      ]),
    }))
    const { default: sitemap } = await import('@/app/sitemap')
    const result = await sitemap()
    expect(result).toHaveLength(1)
    expect(result[0]?.alternates).toBeUndefined()
    expect(result[0]?.url).toBe('https://bythiagofigueiredo.com/privacy')
  })
})
