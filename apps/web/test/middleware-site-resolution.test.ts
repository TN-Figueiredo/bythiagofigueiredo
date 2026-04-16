import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the service client factory (apps/web has this from Sprint 1b)
vi.mock('../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ /* not used; SupabaseRingContext is mocked */ }),
}))

// Mock SupabaseRingContext from the package — isolate middleware from real DB
vi.mock('@tn-figueiredo/cms/ring', () => {
  return {
    SupabaseRingContext: vi.fn().mockImplementation(() => ({
      getSiteByDomain: vi.fn().mockImplementation((domain: string) => {
        if (domain === 'bythiagofigueiredo.com' || domain === 'localhost') {
          return Promise.resolve({
            id: 'site-1',
            org_id: 'org-1',
            default_locale: 'pt-BR',
            domains: ['bythiagofigueiredo.com', 'localhost'],
            supported_locales: ['pt-BR', 'en'],
            name: 'BTF',
            slug: 'bythiagofigueiredo',
            created_at: '',
            updated_at: '',
          })
        }
        return Promise.resolve(null)
      }),
    })),
  }
})

// Mock auth middleware to avoid pulling in Supabase env
vi.mock('@tn-figueiredo/auth-nextjs/middleware', () => ({
  createAuthMiddleware: () => async () => {
    const { NextResponse } = await import('next/server')
    return NextResponse.next()
  },
}))

beforeEach(() => { vi.clearAllMocks() })

describe('middleware site resolution', () => {
  it('sets x-site-id, x-org-id, x-default-locale headers for a known host', async () => {
    const { default: middleware } = await import('../middleware')
    const req = new NextRequest(
      new Request('http://bythiagofigueiredo.com/blog', { headers: { host: 'bythiagofigueiredo.com' } }),
    )
    const res = await middleware(req)
    expect(res.headers.get('x-site-id')).toBe('site-1')
    expect(res.headers.get('x-org-id')).toBe('org-1')
    expect(res.headers.get('x-default-locale')).toBe('pt-BR')
  })

  it('does NOT set site headers for an unknown host', async () => {
    const { default: middleware } = await import('../middleware')
    const req = new NextRequest(
      new Request('http://unknown.example/blog', { headers: { host: 'unknown.example' } }),
    )
    const res = await middleware(req)
    expect(res.headers.get('x-site-id')).toBeNull()
  })

  it('resolves hostname stripping port (dev: localhost:3001)', async () => {
    const { default: middleware } = await import('../middleware')
    const req = new NextRequest(
      new Request('http://localhost:3001/blog', { headers: { host: 'localhost:3001' } }),
    )
    const res = await middleware(req)
    expect(res.headers.get('x-site-id')).toBe('site-1')
  })
})
