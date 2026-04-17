import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies BEFORE importing the route (Vitest hoists vi.mock).
vi.mock('@/lib/seo/host', () => ({
  resolveSiteByHost: vi.fn(),
  isPreviewOrDevHost: vi.fn(() => false),
}))
vi.mock('@/lib/seo/config', () => ({
  getSiteSeoConfig: vi.fn(),
}))
vi.mock('@/lib/seo/enumerator', () => ({
  enumerateSiteRoutes: vi.fn(),
}))

import { GET } from '@/app/api/health/seo/route'
import { resolveSiteByHost } from '@/lib/seo/host'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { enumerateSiteRoutes } from '@/lib/seo/enumerator'

const ORIGINAL_ENV = { ...process.env }

function makeReq(opts: { auth?: string | null; host?: string } = {}): NextRequest {
  const headers = new Headers()
  if (opts.auth !== null) headers.set('authorization', opts.auth ?? 'Bearer test-cron-secret')
  headers.set('host', opts.host ?? 'bythiagofigueiredo.com')
  return new NextRequest('https://bythiagofigueiredo.com/api/health/seo', { headers })
}

describe('GET /api/health/seo', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-cron-secret'
    delete process.env.NEXT_PUBLIC_SEO_JSONLD_ENABLED
    delete process.env.NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED
    delete process.env.NEXT_PUBLIC_SEO_EXTENDED_SCHEMAS_ENABLED
    delete process.env.SEO_AI_CRAWLERS_BLOCKED
    delete process.env.SEO_SITEMAP_KILLED
    vi.clearAllMocks()
  })
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('returns 401 when authorization header missing', async () => {
    const res = await GET(makeReq({ auth: null }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when bearer token does not match CRON_SECRET', async () => {
    const res = await GET(makeReq({ auth: 'Bearer wrong' }))
    expect(res.status).toBe(401)
  })

  it('returns 503 when site cannot be resolved by host', async () => {
    vi.mocked(resolveSiteByHost).mockResolvedValue(null)
    const res = await GET(makeReq({ host: 'unknown.example.com' }))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe('site_not_resolved')
  })

  it('returns 200 with shape from spec when site resolves', async () => {
    vi.mocked(resolveSiteByHost).mockResolvedValue({
      id: 'site-uuid-1',
      slug: 'bythiagofigueiredo',
      primary_domain: 'bythiagofigueiredo.com',
    })
    vi.mocked(getSiteSeoConfig).mockResolvedValue({
      siteId: 'site-uuid-1',
      siteName: 'By Thiago Figueiredo',
      siteUrl: 'https://bythiagofigueiredo.com',
      identityType: 'person',
      defaultLocale: 'pt-BR',
      supportedLocales: ['pt-BR', 'en'],
      primaryColor: '#0F172A',
      logoUrl: null,
      twitterHandle: 'tnFigueiredo',
      defaultOgImageUrl: null,
      contentPaths: { blog: '/blog', campaigns: '/campaigns' },
      personIdentity: null,
      orgIdentity: null,
    })
    vi.mocked(enumerateSiteRoutes).mockResolvedValue(
      Array.from({ length: 17 }, (_, i) => ({
        path: `/r/${i}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.5,
        alternates: {},
      })),
    )

    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      ok: true,
      siteId: 'site-uuid-1',
      siteSlug: 'bythiagofigueiredo',
      identityType: 'person',
      sitemapRouteCount: 17,
      schemaVersion: 'v1',
    })
    expect(typeof body.seoConfigCachedMs).toBe('number')
    expect(typeof body.sitemapBuildMs).toBe('number')
    expect(body.flags).toMatchObject({
      jsonLd: expect.any(Boolean),
      dynamicOg: expect.any(Boolean),
      extendedSchemas: expect.any(Boolean),
      aiCrawlersBlocked: expect.any(Boolean),
      sitemapKilled: expect.any(Boolean),
    })
  })

  it('flags reflect env var state', async () => {
    process.env.NEXT_PUBLIC_SEO_JSONLD_ENABLED = 'false'
    process.env.SEO_AI_CRAWLERS_BLOCKED = 'true'
    process.env.SEO_SITEMAP_KILLED = 'true'
    vi.mocked(resolveSiteByHost).mockResolvedValue({
      id: 's',
      slug: 'bythiagofigueiredo',
      primary_domain: 'bythiagofigueiredo.com',
    })
    vi.mocked(getSiteSeoConfig).mockResolvedValue({
      siteId: 's',
      siteName: 'x',
      siteUrl: 'https://bythiagofigueiredo.com',
      identityType: 'person',
      defaultLocale: 'pt-BR',
      supportedLocales: ['pt-BR'],
      primaryColor: '#000',
      logoUrl: null,
      twitterHandle: null,
      defaultOgImageUrl: null,
      contentPaths: { blog: '/blog', campaigns: '/campaigns' },
      personIdentity: null,
      orgIdentity: null,
    })
    vi.mocked(enumerateSiteRoutes).mockResolvedValue([])

    const res = await GET(makeReq())
    const body = await res.json()
    expect(body.flags.jsonLd).toBe(false)
    expect(body.flags.aiCrawlersBlocked).toBe(true)
    expect(body.flags.sitemapKilled).toBe(true)
  })
})
