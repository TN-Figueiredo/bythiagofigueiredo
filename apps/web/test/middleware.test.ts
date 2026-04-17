import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

const LOCAL_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

// Sprint 4.75 Track B: middleware now runs site resolution FIRST via the
// anon-key ring context. For this test to focus on auth gating (not site
// resolution), we stub the ring to resolve localhost to a known site.
vi.mock('@tn-figueiredo/cms/ring', () => ({
  SupabaseRingContext: class {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_client: unknown) {}
    getSiteByDomain(domain: string) {
      if (domain === 'localhost') {
        return Promise.resolve({
          id: 'site-1',
          org_id: 'org-1',
          default_locale: 'pt-BR',
          domains: ['localhost'],
          supported_locales: ['pt-BR'],
          name: 'LocalDev',
          slug: 'localdev',
          created_at: '',
          updated_at: '',
          cms_enabled: true,
        })
      }
      return Promise.resolve(null)
    }
  },
}))

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', LOCAL_ANON)
})
afterAll(() => {
  vi.unstubAllEnvs()
})

async function loadMiddleware() {
  const mod = await import('../src/middleware')
  return mod.default
}

function makeReq(path: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3001${path}`), {
    headers: new Headers({ host: 'localhost:3001' }),
  })
}

describe('middleware', () => {
  it('redirects unauthenticated request to /cms → /cms/login', async () => {
    const middleware = await loadMiddleware()
    const res = await middleware(makeReq('/cms'))
    expect([307, 308]).toContain(res.status)
    expect(res.headers.get('location') ?? '').toMatch(/\/cms\/login/)
  })

  it('redirects unauthenticated request to /admin → /admin/login', async () => {
    const middleware = await loadMiddleware()
    const res = await middleware(makeReq('/admin'))
    expect([307, 308]).toContain(res.status)
    expect(res.headers.get('location') ?? '').toMatch(/\/admin\/login/)
  })

  it('lets anonymous GET / through', async () => {
    const middleware = await loadMiddleware()
    const res = await middleware(makeReq('/'))
    expect([200, 404, undefined]).toContain(res.status)
  })
})
