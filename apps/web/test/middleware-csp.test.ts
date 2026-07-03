import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { buildLegacyCsp } from '@/lib/security/csp'

/**
 * BTF-089b — CSP nonce matrix over EVERY middleware exit path.
 *
 * For each NextResponse creation site in src/middleware.ts we assert, with
 * CSP_NONCE_ENABLED=true:
 *   1. the response carries a Content-Security-Policy containing 'nonce-'
 *   2. pass-through responses (next/rewrite) carry the nonce on the REQUEST
 *      headers (x-middleware-request-x-nonce) — that is what Next.js reads to
 *      tag its own inline scripts — and the request-CSP nonce matches the
 *      response-CSP nonce
 *   3. the nonce differs between two requests
 * And with the flag OFF the enforced policy is byte-identical to the legacy
 * policy (the exact pre-migration next.config.ts string).
 */

const LOCAL_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

vi.mock('@tn-figueiredo/cms/ring', () => ({
  SupabaseRingContext: class {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_client: unknown) {}
    getSiteByDomain(domain: string) {
      if (domain === 'error.test') {
        return Promise.reject(new Error('boom'))
      }
      if (domain === 'disabled.test') {
        return Promise.resolve({
          id: 'site-disabled',
          org_id: 'org-1',
          default_locale: 'pt-BR',
          domains: ['disabled.test'],
          supported_locales: ['pt-BR'],
          name: 'Disabled',
          slug: 'disabled',
          created_at: '',
          updated_at: '',
          cms_enabled: false,
        })
      }
      if (
        domain === 'bythiagofigueiredo.com' ||
        domain === 'dev.bythiagofigueiredo.com'
      ) {
        return Promise.resolve({
          id: 'site-1',
          org_id: 'org-1',
          default_locale: 'en',
          domains: [domain],
          supported_locales: ['pt-BR', 'en'],
          name: 'BTF',
          slug: 'btf',
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
  createAuthMiddleware: () =>
    vi.fn().mockImplementation(async (req: NextRequest) => {
      // /admin/secure simulates an unauthenticated redirect so the matrix
      // also covers the mergeSiteHeaders `authResponse.status >= 300` branch.
      if (req.nextUrl.pathname.startsWith('/admin/secure')) {
        return NextResponse.redirect(new URL('/admin/login', req.url), 307)
      }
      return NextResponse.next()
    }),
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

function extractNonce(csp: string | null): string | null {
  const match = /'nonce-([^']+)'/.exec(csp ?? '')
  return match?.[1] ?? null
}

interface ExitCase {
  label: string
  host: string
  path: string
  /** pass-through responses must carry the nonce on the request headers */
  kind: 'next' | 'rewrite' | 'redirect'
}

// One entry per NextResponse creation site in src/middleware.ts.
const EXIT_MATRIX: ExitCase[] = [
  { label: 'dev subdomain rewrite → /dev/*', host: 'dev.bythiagofigueiredo.com', path: '/about', kind: 'rewrite' },
  { label: 'go.* passthrough (robots.txt)', host: 'go.bythiagofigueiredo.com', path: '/robots.txt', kind: 'next' },
  { label: 'go.* unknown site → /go/not-found', host: 'go.unknown.test', path: '/abc', kind: 'rewrite' },
  { label: 'go.* og image → /go/linktree/og', host: 'go.bythiagofigueiredo.com', path: '/og/linktree', kind: 'rewrite' },
  { label: 'go.* root → /go/linktree', host: 'go.bythiagofigueiredo.com', path: '/', kind: 'rewrite' },
  { label: 'go.* /ig → 301 redirect', host: 'go.bythiagofigueiredo.com', path: '/ig', kind: 'redirect' },
  { label: 'go.* short code → /go/{code}', host: 'go.bythiagofigueiredo.com', path: '/abc', kind: 'rewrite' },
  { label: 'skipSiteResolution (/api/cron/*)', host: 'bythiagofigueiredo.com', path: '/api/cron/health', kind: 'next' },
  { label: 'legacy /pt-BR 301 redirect', host: 'bythiagofigueiredo.com', path: '/pt-BR/blog/x', kind: 'redirect' },
  { label: 'legacy /blog/en 301 redirect', host: 'bythiagofigueiredo.com', path: '/blog/en/x', kind: 'redirect' },
  { label: 'uppercase /PT 308 redirect', host: 'bythiagofigueiredo.com', path: '/PT/blog/x', kind: 'redirect' },
  { label: 'known host public next()', host: 'bythiagofigueiredo.com', path: '/blog/my-post', kind: 'next' },
  { label: '/pt/ locale rewrite', host: 'bythiagofigueiredo.com', path: '/pt/blog/meu-post', kind: 'rewrite' },
  { label: '/pt/cms auth-merged rewrite branch', host: 'bythiagofigueiredo.com', path: '/pt/cms', kind: 'next' },
  { label: '/cms auth-merged next()', host: 'bythiagofigueiredo.com', path: '/cms/blog', kind: 'next' },
  { label: '/admin auth-merged next()', host: 'bythiagofigueiredo.com', path: '/admin/dashboard', kind: 'next' },
  { label: '/admin auth redirect (>=300 branch)', host: 'bythiagofigueiredo.com', path: '/admin/secure', kind: 'redirect' },
  { label: 'unknown host public next()', host: 'unknown.test', path: '/blog', kind: 'next' },
  { label: 'unknown host /cms → /site-not-configured', host: 'unknown.test', path: '/cms/blog', kind: 'rewrite' },
  { label: 'cms_enabled=false → /cms/disabled', host: 'disabled.test', path: '/cms/blog', kind: 'rewrite' },
  { label: 'ring error → /site-error', host: 'error.test', path: '/blog', kind: 'rewrite' },
]

describe('middleware CSP matrix — CSP_NONCE_ENABLED=true', () => {
  for (const exit of EXIT_MATRIX) {
    it(`${exit.label}: enforced nonce CSP + nonce threading`, async () => {
      vi.stubEnv('CSP_NONCE_ENABLED', 'true')
      vi.stubEnv('CSP_NONCE_REPORT_ONLY', '')
      try {
        const middleware = await loadMiddleware()
        const res = await middleware(makeReq(exit.host, exit.path))

        // 1. Enforced CSP with a nonce, exactly one policy, no report-only.
        const csp = res.headers.get('content-security-policy')
        expect(csp, 'response CSP').toBeTruthy()
        const responseNonce = extractNonce(csp)
        expect(responseNonce, `nonce source in: ${csp}`).toBeTruthy()
        expect(res.headers.get('content-security-policy-report-only')).toBeNull()

        // 2. Pass-through responses must thread the nonce + request CSP into
        //    the REQUEST headers (x-middleware-request-*) so Next.js can tag
        //    its own inline scripts with the same nonce.
        if (exit.kind !== 'redirect') {
          const requestNonce = res.headers.get('x-middleware-request-x-nonce')
          expect(requestNonce, 'x-nonce request header').toBe(responseNonce)
          const requestCsp = res.headers.get(
            'x-middleware-request-content-security-policy',
          )
          expect(extractNonce(requestCsp), 'request CSP nonce').toBe(responseNonce)
        }

        // 3. Sanity on the response kind so the matrix stays honest.
        if (exit.kind === 'rewrite') {
          expect(res.headers.get('x-middleware-rewrite')).toBeTruthy()
        }
        if (exit.kind === 'redirect') {
          expect(res.status).toBeGreaterThanOrEqual(300)
          expect(res.status).toBeLessThan(400)
        }
      } finally {
        vi.stubEnv('CSP_NONCE_ENABLED', '')
        vi.stubEnv('CSP_NONCE_REPORT_ONLY', '')
      }
    })
  }

  it('nonce differs between two requests', async () => {
    vi.stubEnv('CSP_NONCE_ENABLED', 'true')
    try {
      const middleware = await loadMiddleware()
      const res1 = await middleware(makeReq('bythiagofigueiredo.com', '/blog'))
      const res2 = await middleware(makeReq('bythiagofigueiredo.com', '/blog'))
      const nonce1 = extractNonce(res1.headers.get('content-security-policy'))
      const nonce2 = extractNonce(res2.headers.get('content-security-policy'))
      expect(nonce1).toBeTruthy()
      expect(nonce2).toBeTruthy()
      expect(nonce1).not.toBe(nonce2)
    } finally {
      vi.stubEnv('CSP_NONCE_ENABLED', '')
    }
  })
})

describe('middleware CSP — flag OFF (legacy rollback)', () => {
  for (const exit of EXIT_MATRIX) {
    it(`${exit.label}: legacy policy, byte-identical, no nonce`, async () => {
      vi.stubEnv('CSP_NONCE_ENABLED', '')
      vi.stubEnv('CSP_NONCE_REPORT_ONLY', '')
      const middleware = await loadMiddleware()
      const res = await middleware(makeReq(exit.host, exit.path))
      // Vitest runs with NODE_ENV !== 'production' → dev variant. Byte
      // identity of both variants against the pre-migration next.config.ts
      // literals is locked down in test/security/csp.test.ts.
      expect(res.headers.get('content-security-policy')).toBe(buildLegacyCsp(true))
      expect(res.headers.get('content-security-policy-report-only')).toBeNull()
      // No request-CSP header is injected in legacy mode (Next must not
      // nonce-tag scripts when the policy has no nonce source).
      expect(
        res.headers.get('x-middleware-request-content-security-policy'),
      ).toBeNull()
    })
  }
})

describe('middleware CSP — CSP_NONCE_REPORT_ONLY=true (rollout stage)', () => {
  it('keeps legacy enforced AND emits the nonce policy as report-only', async () => {
    vi.stubEnv('CSP_NONCE_ENABLED', '')
    vi.stubEnv('CSP_NONCE_REPORT_ONLY', 'true')
    try {
      const middleware = await loadMiddleware()
      const res = await middleware(makeReq('bythiagofigueiredo.com', '/blog'))
      expect(res.headers.get('content-security-policy')).toBe(buildLegacyCsp(true))
      const reportOnly = res.headers.get('content-security-policy-report-only')
      const nonce = extractNonce(reportOnly)
      expect(nonce).toBeTruthy()
      // Nonce must still be threaded into the request so Next tags scripts —
      // otherwise every report would be a false positive.
      expect(res.headers.get('x-middleware-request-x-nonce')).toBe(nonce)
      expect(
        extractNonce(res.headers.get('x-middleware-request-content-security-policy')),
      ).toBe(nonce)
    } finally {
      vi.stubEnv('CSP_NONCE_REPORT_ONLY', '')
    }
  })
})
