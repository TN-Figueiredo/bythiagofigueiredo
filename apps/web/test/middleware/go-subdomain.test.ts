import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

const LOCAL_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

vi.mock('@tn-figueiredo/cms/ring', () => ({
  SupabaseRingContext: class {
    constructor(_client: unknown) {}
    getSiteByDomain(domain: string) {
      if (domain === 'bythiagofigueiredo.com') {
        return Promise.resolve({
          id: 'site-1',
          org_id: 'org-1',
          default_locale: 'pt-BR',
          domains: ['bythiagofigueiredo.com'],
          supported_locales: ['pt-BR', 'en'],
          name: 'ByThiagoFigueiredo',
          slug: 'bythiagofigueiredo',
          created_at: '',
          updated_at: '',
          cms_enabled: true,
        })
      }
      return Promise.resolve(null)
    }
  },
}))

vi.mock('@tn-figueiredo/auth-nextjs/middleware', () => ({
  createAuthMiddleware: () => async () => {
    const { NextResponse } = await import('next/server')
    return NextResponse.next()
  },
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', LOCAL_ANON)
})
afterAll(() => {
  vi.unstubAllEnvs()
})

function makeReq(path: string, host: string): NextRequest {
  return new NextRequest(new URL(`http://${host}${path}`), {
    headers: new Headers({ host }),
  })
}

describe('middleware: go.* subdomain', () => {
  it('rewrites go.domain.com/abc to /go/abc with x-site-id and x-short-domain', async () => {
    const mod = await import('../../src/middleware')
    const middleware = mod.default
    const req = makeReq('/abc', 'go.bythiagofigueiredo.com')
    const res = await middleware(req)
    expect(res.headers.get('x-middleware-rewrite')).toContain('/go/abc')
    expect(res.headers.get('x-site-id')).toBe('site-1')
    expect(res.headers.get('x-short-domain')).toBe('go.bythiagofigueiredo.com')
  })

  it('does not apply locale rewrite logic for go.* requests', async () => {
    const mod = await import('../../src/middleware')
    const middleware = mod.default
    const req = makeReq('/pt/mycode', 'go.bythiagofigueiredo.com')
    const res = await middleware(req)
    // Should treat /pt/mycode as a code, not a locale prefix
    expect(res.headers.get('x-middleware-rewrite')).toContain('/go/pt/mycode')
  })

  it('returns not-found rewrite when go.* host base domain is unknown', async () => {
    const mod = await import('../../src/middleware')
    const middleware = mod.default
    const req = makeReq('/xyz', 'go.unknown-domain.com')
    const res = await middleware(req)
    expect(res.headers.get('x-middleware-rewrite')).toContain('/go/not-found')
  })

  it('passes through root path on go.* to /go (index)', async () => {
    const mod = await import('../../src/middleware')
    const middleware = mod.default
    const req = makeReq('/', 'go.bythiagofigueiredo.com')
    const res = await middleware(req)
    expect(res.headers.get('x-middleware-rewrite')).toContain('/go')
  })
})
