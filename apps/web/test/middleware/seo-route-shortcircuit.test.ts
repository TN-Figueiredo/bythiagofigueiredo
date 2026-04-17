import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

const LOCAL_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

/**
 * Sprint 5b PR-B Phase 3 — middleware MUST short-circuit `/sitemap.xml` and
 * `/robots.txt` from the dev-subdomain rewrite. Otherwise a request to
 * `dev.bythiagofigueiredo.com/sitemap.xml` would be rewritten to
 * `/dev/sitemap.xml` (which doesn't exist) and the route handler — which
 * already detects preview/dev hosts and returns Disallow:/ — would never run.
 *
 * Assertion strategy: NextResponse.rewrite sets `x-middleware-rewrite` to the
 * absolute target URL. We assert it does NOT contain `/dev/sitemap.xml` or
 * `/dev/robots.txt`.
 */

vi.mock('@tn-figueiredo/cms/ring', () => ({
  SupabaseRingContext: class {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_client: unknown) {}
    getSiteByDomain(domain: string) {
      if (domain === 'dev.bythiagofigueiredo.com') {
        return Promise.resolve({
          id: 'site-dev',
          org_id: 'org-1',
          default_locale: 'pt-BR',
          domains: ['dev.bythiagofigueiredo.com'],
          supported_locales: ['pt-BR'],
          name: 'Dev',
          slug: 'dev',
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
  const mod = await import('@/middleware')
  return mod.default
}

function makeReq(host: string, path: string): NextRequest {
  return new NextRequest(new URL(`https://${host}${path}`), {
    headers: new Headers({ host }),
  })
}

describe('middleware SEO route short-circuit', () => {
  it('does NOT rewrite /sitemap.xml on dev.bythiagofigueiredo.com to /dev/sitemap.xml', async () => {
    const middleware = await loadMiddleware()
    const res = await middleware(makeReq('dev.bythiagofigueiredo.com', '/sitemap.xml'))
    const rewriteHeader = res.headers.get('x-middleware-rewrite') ?? ''
    expect(rewriteHeader).not.toContain('/dev/sitemap.xml')
  })

  it('does NOT rewrite /robots.txt on dev subdomain', async () => {
    const middleware = await loadMiddleware()
    const res = await middleware(makeReq('dev.bythiagofigueiredo.com', '/robots.txt'))
    const rewriteHeader = res.headers.get('x-middleware-rewrite') ?? ''
    expect(rewriteHeader).not.toContain('/dev/robots.txt')
  })

  it('still rewrites non-SEO routes on dev.bythiagofigueiredo.com to /dev/*', async () => {
    const middleware = await loadMiddleware()
    const res = await middleware(makeReq('dev.bythiagofigueiredo.com', '/about'))
    const rewriteHeader = res.headers.get('x-middleware-rewrite') ?? ''
    expect(rewriteHeader).toContain('/dev/about')
  })
})
