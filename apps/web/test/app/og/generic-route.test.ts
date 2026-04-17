import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Sprint 5b PR-B Phase 3 — `/og/[type]` generic OG route.
 *
 * Whitelists `type` values: root | legal | contact | blog-index | campaigns-index.
 * Accepts an optional `?title=` override sanitized via control-char strip +
 * 120-char truncate.
 */
describe('GET /og/[type]', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllEnvs())

  it('returns 302 fallback when flag disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED', 'false')
    const { GET } = await import('@/app/og/[type]/route')
    const req = new NextRequest('https://example.com/og/root', {
      headers: { host: 'example.com' },
    })
    const res = await GET(req, { params: Promise.resolve({ type: 'root' }) })
    expect(res.status).toBe(302)
  })

  it('returns 302 fallback for unknown type', async () => {
    const { GET } = await import('@/app/og/[type]/route')
    const req = new NextRequest('https://example.com/og/hax', {
      headers: { host: 'example.com' },
    })
    const res = await GET(req, { params: Promise.resolve({ type: 'hax' }) })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/og-default.png')
  })

  it('returns 302 fallback when site not resolved', async () => {
    vi.doMock('@/lib/seo/host', () => ({
      resolveSiteByHost: vi.fn().mockResolvedValue(null),
      isPreviewOrDevHost: () => false,
    }))
    const { GET } = await import('@/app/og/[type]/route')
    const req = new NextRequest('https://unknown.test/og/root', {
      headers: { host: 'unknown.test' },
    })
    const res = await GET(req, { params: Promise.resolve({ type: 'root' }) })
    expect(res.status).toBe(302)
  })

  it('renders generic OG image with default title for the type', async () => {
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
      }),
    }))
    const renderGenericOgImage = vi
      .fn()
      .mockResolvedValue(new Response('img', { status: 200 }))
    vi.doMock('@/lib/seo/og/render', () => ({
      renderGenericOgImage,
      notFoundOgFallback: () =>
        new Response(null, { status: 302, headers: { Location: '/og-default.png' } }),
    }))
    const { GET } = await import('@/app/og/[type]/route')
    const req = new NextRequest('https://bythiagofigueiredo.com/og/blog-index', {
      headers: { host: 'bythiagofigueiredo.com' },
    })
    const res = await GET(req, { params: Promise.resolve({ type: 'blog-index' }) })
    expect(res.status).toBe(200)
    expect(renderGenericOgImage).toHaveBeenCalledWith({
      title: 'Blog',
      siteName: 'ByThiagoFigueiredo',
      brandColor: '#0F172A',
    })
  })

  it('uses ?title= override and sanitizes control characters + truncates to 120', async () => {
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
        siteName: 'Site',
        primaryColor: '#000000',
      }),
    }))
    const renderGenericOgImage = vi
      .fn()
      .mockResolvedValue(new Response('img', { status: 200 }))
    vi.doMock('@/lib/seo/og/render', () => ({
      renderGenericOgImage,
      notFoundOgFallback: () =>
        new Response(null, { status: 302, headers: { Location: '/og-default.png' } }),
    }))
    // Build a malicious title with NUL + DEL + 200 chars
    const long = 'A'.repeat(200)
    const dirty = `Hello\x00World\x7f${long}`
    const url = `https://bythiagofigueiredo.com/og/root?title=${encodeURIComponent(dirty)}`
    const { GET } = await import('@/app/og/[type]/route')
    const req = new NextRequest(url, { headers: { host: 'bythiagofigueiredo.com' } })
    await GET(req, { params: Promise.resolve({ type: 'root' }) })
    const calledWith = renderGenericOgImage.mock.calls[0]?.[0] as { title: string }
    expect(calledWith.title.length).toBeLessThanOrEqual(120)
    expect(calledWith.title).not.toContain('\x00')
    expect(calledWith.title).not.toContain('\x7f')
    expect(calledWith.title.startsWith('HelloWorld')).toBe(true)
  })
})
