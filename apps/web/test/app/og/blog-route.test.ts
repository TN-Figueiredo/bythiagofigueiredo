import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Sprint 5b PR-B Phase 3 — `/og/blog/[locale]/[slug]` Node-runtime OG route.
 *
 * Contract:
 *   - Flag `NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED=false` → 302 to /og-default.png
 *   - Unknown host (resolveSiteByHost null) → 302 fallback
 *   - Post not found → 302 fallback
 *   - Happy path → calls renderBlogOgImage with title/author/locale/brand/logo
 *   - Any thrown error → Sentry capture + 302 fallback
 */
describe('GET /og/blog/[locale]/[slug]', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllEnvs())

  it('returns 302 fallback when flag disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED', 'false')
    const { GET } = await import('@/app/og/blog/[locale]/[slug]/route')
    const req = new NextRequest('https://example.com/og/blog/pt-BR/slug', {
      headers: { host: 'example.com' },
    })
    const res = await GET(req, {
      params: Promise.resolve({ locale: 'pt-BR', slug: 'slug' }),
    })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/og-default.png')
  })

  it('returns 302 fallback when site not resolved', async () => {
    vi.doMock('@/lib/seo/host', () => ({
      resolveSiteByHost: vi.fn().mockResolvedValue(null),
      isPreviewOrDevHost: () => false,
    }))
    const { GET } = await import('@/app/og/blog/[locale]/[slug]/route')
    const req = new NextRequest('https://unknown.test/og/blog/pt-BR/s', {
      headers: { host: 'unknown.test' },
    })
    const res = await GET(req, {
      params: Promise.resolve({ locale: 'pt-BR', slug: 's' }),
    })
    expect(res.status).toBe(302)
  })

  it('returns 302 fallback when post not found', async () => {
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
      postRepo: () => ({ getBySlug: vi.fn().mockResolvedValue(null) }),
    }))
    const { GET } = await import('@/app/og/blog/[locale]/[slug]/route')
    const req = new NextRequest('https://bythiagofigueiredo.com/og/blog/pt-BR/missing', {
      headers: { host: 'bythiagofigueiredo.com' },
    })
    const res = await GET(req, {
      params: Promise.resolve({ locale: 'pt-BR', slug: 'missing' }),
    })
    expect(res.status).toBe(302)
  })

  it('renders OG image on happy path', async () => {
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
      postRepo: () => ({
        getBySlug: vi.fn().mockResolvedValue({
          id: 'post-1',
          translations: [{ locale: 'pt-BR', title: 'Hello world', slug: 'hello' }],
        }),
      }),
    }))
    const renderBlogOgImage = vi.fn().mockResolvedValue(new Response('img', { status: 200 }))
    vi.doMock('@/lib/seo/og/render', () => ({
      renderBlogOgImage,
      notFoundOgFallback: () =>
        new Response(null, { status: 302, headers: { Location: '/og-default.png' } }),
    }))
    const { GET } = await import('@/app/og/blog/[locale]/[slug]/route')
    const req = new NextRequest('https://bythiagofigueiredo.com/og/blog/pt-BR/hello', {
      headers: { host: 'bythiagofigueiredo.com' },
    })
    const res = await GET(req, {
      params: Promise.resolve({ locale: 'pt-BR', slug: 'hello' }),
    })
    expect(res.status).toBe(200)
    expect(renderBlogOgImage).toHaveBeenCalledWith({
      title: 'Hello world',
      author: 'Thiago',
      locale: 'pt-BR',
      brandColor: '#0F172A',
      logoUrl: null,
    })
  })
})
