import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@tn-figueiredo/cms/ring', () => ({
  SupabaseRingContext: vi.fn().mockImplementation(() => ({
    getSiteByDomain: vi.fn().mockImplementation((domain: string) => {
      if (domain === 'bythiagofigueiredo.com') {
        return Promise.resolve({
          id: 'site-1',
          org_id: 'org-1',
          default_locale: 'en',
          cms_enabled: true,
        })
      }
      return Promise.resolve(null)
    }),
  })),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@tn-figueiredo/auth-nextjs/middleware', () => ({
  createAuthMiddleware: () =>
    vi.fn().mockImplementation(async (_req: NextRequest) => NextResponse.next()),
}))

describe('middleware locale detection', () => {
  let middleware: (req: NextRequest) => Promise<NextResponse>

  beforeEach(async () => {
    vi.resetModules()
    // Re-apply mocks after resetModules
    vi.doMock('@tn-figueiredo/cms/ring', () => ({
      SupabaseRingContext: vi.fn().mockImplementation(() => ({
        getSiteByDomain: vi.fn().mockImplementation((domain: string) => {
          if (domain === 'bythiagofigueiredo.com') {
            return Promise.resolve({
              id: 'site-1',
              org_id: 'org-1',
              default_locale: 'en',
              cms_enabled: true,
            })
          }
          return Promise.resolve(null)
        }),
      })),
    }))
    vi.doMock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
    vi.doMock('@tn-figueiredo/auth-nextjs/middleware', () => ({
      createAuthMiddleware: () =>
        vi.fn().mockImplementation(async (_req: NextRequest) => NextResponse.next()),
    }))
    const mod = await import('../src/middleware')
    middleware = mod.middleware
  })

  it('sets x-locale=en for unprefixed paths', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/blog/my-post')
    const res = await middleware(req)
    expect(res.headers.get('x-locale')).toBe('en')
  })

  it('sets x-locale=pt-BR and rewrites for /pt/ prefix', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/pt/blog/meu-post')
    const res = await middleware(req)
    expect(res.headers.get('x-locale')).toBe('pt-BR')
  })

  it('sets x-locale=pt-BR for exact /pt path', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/pt')
    const res = await middleware(req)
    expect(res.headers.get('x-locale')).toBe('pt-BR')
  })

  it('301 redirects /pt-BR to /pt', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/pt-BR')
    const res = await middleware(req)
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://bythiagofigueiredo.com/pt')
  })

  it('301 redirects /pt-BR/blog/x to /pt/blog/x', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/pt-BR/blog/x')
    const res = await middleware(req)
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://bythiagofigueiredo.com/pt/blog/x')
  })

  it('301 redirects /blog/pt-BR/slug to /pt/blog/slug', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/blog/pt-BR/my-post')
    const res = await middleware(req)
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://bythiagofigueiredo.com/pt/blog/my-post')
  })

  it('301 redirects /blog/en/slug to /blog/slug', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/blog/en/my-post')
    const res = await middleware(req)
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://bythiagofigueiredo.com/blog/my-post')
  })

  it('301 redirects /campaigns/pt-BR/slug to /pt/campaigns/slug', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/campaigns/pt-BR/my-campaign')
    const res = await middleware(req)
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://bythiagofigueiredo.com/pt/campaigns/my-campaign')
  })

  it('301 redirects /campaigns/en/slug to /campaigns/slug', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/campaigns/en/my-campaign')
    const res = await middleware(req)
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://bythiagofigueiredo.com/campaigns/my-campaign')
  })

  it('308 redirects /PT/blog/x to /pt/blog/x', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/PT/blog/x')
    const res = await middleware(req)
    expect(res.status).toBe(308)
    expect(res.headers.get('location')).toBe('https://bythiagofigueiredo.com/pt/blog/x')
  })

  it('does not set x-locale for /admin paths', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/admin/dashboard')
    const res = await middleware(req)
    expect(res.headers.get('x-locale')).toBeNull()
  })

  it('does not set x-locale for /cms paths', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/cms/blog')
    const res = await middleware(req)
    expect(res.headers.get('x-locale')).toBeNull()
  })

  it('does not set x-locale for /api paths', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/api/health')
    const res = await middleware(req)
    expect(res.headers.get('x-locale')).toBeNull()
  })
})
