import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Sprint 5b PR-B Phase 3 — `/og/campaigns/[locale]/[slug]` dynamic OG route.
 *
 * Mirrors the blog route but consumes `getCampaignBySlug` (B.19a) instead of
 * `postRepo().getBySlug` because `@tn-figueiredo/cms` SupabaseCampaignRepository
 * does NOT expose a slug-based lookup.
 */
describe('GET /og/campaigns/[locale]/[slug]', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllEnvs())

  it('returns 302 fallback when flag disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED', 'false')
    const { GET } = await import('@/app/og/campaigns/[locale]/[slug]/route')
    const req = new NextRequest('https://example.com/og/campaigns/pt-BR/launch', {
      headers: { host: 'example.com' },
    })
    const res = await GET(req, {
      params: Promise.resolve({ locale: 'pt-BR', slug: 'launch' }),
    })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/og-default.png')
  })

  it('returns 302 fallback when site not resolved', async () => {
    vi.doMock('@/lib/seo/host', () => ({
      resolveSiteByHost: vi.fn().mockResolvedValue(null),
      isPreviewOrDevHost: () => false,
    }))
    const { GET } = await import('@/app/og/campaigns/[locale]/[slug]/route')
    const req = new NextRequest('https://unknown.test/og/campaigns/pt-BR/x', {
      headers: { host: 'unknown.test' },
    })
    const res = await GET(req, {
      params: Promise.resolve({ locale: 'pt-BR', slug: 'x' }),
    })
    expect(res.status).toBe(302)
  })

  it('returns 302 fallback when campaign not found', async () => {
    vi.doMock('@/lib/seo/host', () => ({
      resolveSiteByHost: vi.fn().mockResolvedValue({
        id: 'site-1',
        slug: 'bythiagofigueiredo',
        primary_domain: 'bythiagofigueiredo.com',
      }),
      isPreviewOrDevHost: () => false,
    }))
    vi.doMock('@/lib/seo/config', () => ({
      getSiteSeoConfig: vi.fn().mockResolvedValue({
        siteName: 'ByThiagoFigueiredo',
        primaryColor: '#0F172A',
        logoUrl: null,
        personIdentity: { name: 'Thiago' },
      }),
    }))
    vi.doMock('@/lib/cms/repositories', () => ({
      getCampaignBySlug: vi.fn().mockResolvedValue(null),
    }))
    const { GET } = await import('@/app/og/campaigns/[locale]/[slug]/route')
    const req = new NextRequest('https://bythiagofigueiredo.com/og/campaigns/pt-BR/missing', {
      headers: { host: 'bythiagofigueiredo.com' },
    })
    const res = await GET(req, {
      params: Promise.resolve({ locale: 'pt-BR', slug: 'missing' }),
    })
    expect(res.status).toBe(302)
  })

  it('renders OG image on happy path using meta_title', async () => {
    vi.doMock('@/lib/seo/host', () => ({
      resolveSiteByHost: vi.fn().mockResolvedValue({
        id: 'site-1',
        slug: 'bythiagofigueiredo',
        primary_domain: 'bythiagofigueiredo.com',
      }),
      isPreviewOrDevHost: () => false,
    }))
    vi.doMock('@/lib/seo/config', () => ({
      getSiteSeoConfig: vi.fn().mockResolvedValue({
        siteName: 'ByThiagoFigueiredo',
        primaryColor: '#22D3EE',
        logoUrl: '/logo.png',
        personIdentity: { name: 'Thiago' },
      }),
    }))
    vi.doMock('@/lib/cms/repositories', () => ({
      getCampaignBySlug: vi.fn().mockResolvedValue({
        id: 'camp-1',
        translation: {
          locale: 'pt-BR',
          slug: 'launch',
          meta_title: 'Big Launch',
          meta_description: null,
          og_image_url: null,
        },
      }),
    }))
    const renderCampaignOgImage = vi
      .fn()
      .mockResolvedValue(new Response('img', { status: 200 }))
    vi.doMock('@/lib/seo/og/render', () => ({
      renderCampaignOgImage,
      notFoundOgFallback: () =>
        new Response(null, { status: 302, headers: { Location: '/og-default.png' } }),
    }))
    const { GET } = await import('@/app/og/campaigns/[locale]/[slug]/route')
    const req = new NextRequest('https://bythiagofigueiredo.com/og/campaigns/pt-BR/launch', {
      headers: { host: 'bythiagofigueiredo.com' },
    })
    const res = await GET(req, {
      params: Promise.resolve({ locale: 'pt-BR', slug: 'launch' }),
    })
    expect(res.status).toBe(200)
    expect(renderCampaignOgImage).toHaveBeenCalledWith({
      title: 'Big Launch',
      author: 'Thiago',
      locale: 'pt-BR',
      brandColor: '#22D3EE',
      logoUrl: '/logo.png',
    })
  })
})
