// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

const { headersMock } = vi.hoisted(() => ({ headersMock: vi.fn() }))
vi.mock('next/headers', () => ({ headers: () => headersMock() }))

/**
 * A4 — "nenhum header de confiança sobrevive à borda".
 *
 * Os 8 nomes abaixo são tratados como confiáveis por algum consumidor:
 *   - x-site-id / x-org-id / x-default-locale / x-site-timezone / x-locale
 *     são escritos pelo próprio middleware (src/middleware.ts:367,463-466,
 *     506-510) e lidos por lib/cms/site-context.ts;
 *   - x-primary-domain é lido em lib/cms/site-context.ts:36 e nunca escrito;
 *   - x-short-domain é lido em src/app/go/route.ts e
 *     src/app/go/linktree/layout.tsx e só é escrito na *resposta* do ramo
 *     go.*;
 *   - content-security-policy é lido pelo PRÓPRIO Next a partir do request
 *     para decidir com que nonce marcar os scripts inline, e o middleware só o
 *     sobrescreve fora do modo `legacy` (src/lib/security/csp.ts:52-56) — que
 *     é o default. Este arquivo roda deliberadamente em modo `legacy`, onde
 *     não existe `set` para mascarar a falha.
 *
 * O teste lê a lista `x-middleware-override-headers` que o Next emite quando o
 * middleware cria a resposta com `{ request: { headers } }`: essa lista É o
 * conjunto de headers que o route handler / server component vai enxergar.
 */

const LOCAL_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const TRUSTED_HEADERS = [
  'x-site-id',
  'x-org-id',
  'x-default-locale',
  'x-site-timezone',
  'x-locale',
  'x-primary-domain',
  'x-short-domain',
  'content-security-policy',
] as const

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

vi.mock('@tn-figueiredo/auth-nextjs/middleware', () => ({
  createAuthMiddleware: () => async () => {
    const { NextResponse } = await import('next/server')
    return NextResponse.next()
  },
}))

vi.mock('@tn-figueiredo/cms/ring', () => ({
  SupabaseRingContext: class {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', LOCAL_ANON)
  // Modo `legacy` explícito: é nele que o `set` condicional de
  // src/middleware.ts:174 NÃO acontece e um CSP forjado chegaria ao framework.
  vi.stubEnv('CSP_NONCE_ENABLED', '')
  vi.stubEnv('CSP_NONCE_REPORT_ONLY', '')
})
afterAll(() => {
  vi.unstubAllEnvs()
})

/** Requisição com os 8 headers forjados, cada um com um valor reconhecível. */
function forgedRequest(path: string, host: string): NextRequest {
  const headers = new Headers({ host })
  for (const name of TRUSTED_HEADERS) headers.set(name, `forged-${name}`)
  return new NextRequest(new URL(`https://${host}${path}`), { headers })
}

/** Headers que o Next vai entregar a jusante, extraídos da resposta. */
function forwardedRequestHeaders(res: Response): Map<string, string> {
  const list = res.headers.get('x-middleware-override-headers') ?? ''
  const out = new Map<string, string>()
  for (const key of list.split(',').map((k) => k.trim()).filter(Boolean)) {
    out.set(key.toLowerCase(), res.headers.get(`x-middleware-request-${key}`) ?? '')
  }
  return out
}

describe('middleware: forged trusted headers are stripped at the edge', () => {
  it('drops all 8 on the skipSiteResolution path (/api/cron/*)', async () => {
    const { middleware } = await import('@/middleware')
    const res = await middleware(
      forgedRequest('/api/cron/instagram-sync', 'bythiagofigueiredo.com'),
    )
    const forwarded = forwardedRequestHeaders(res)
    // Sanidade: a lista existe e o middleware realmente escreveu nela.
    expect(forwarded.get('x-nonce')).toBeTruthy()
    for (const name of TRUSTED_HEADERS) {
      expect(forwarded.has(name), `${name} must not reach the route handler`).toBe(false)
    }
  })

  it('drops all 8 on the unknown-host path, keeping only the locale it writes itself', async () => {
    const { middleware } = await import('@/middleware')
    const res = await middleware(forgedRequest('/blog', 'unknown.test'))
    const forwarded = forwardedRequestHeaders(res)
    // /blog não está em skipLocale, então o middleware escreve x-locale ele
    // mesmo (src/middleware.ts:367) — o valor tem de ser o dele, não o forjado.
    expect(forwarded.get('x-locale')).toBe('en')
    for (const name of TRUSTED_HEADERS) {
      if (name === 'x-locale') continue
      expect(forwarded.has(name), `${name} must not survive an unknown host`).toBe(false)
    }
  })

  it('replaces the forged values with the resolved ones on a known host', async () => {
    const { middleware } = await import('@/middleware')
    const res = await middleware(forgedRequest('/blog', 'bythiagofigueiredo.com'))
    const forwarded = forwardedRequestHeaders(res)
    expect(forwarded.get('x-site-id')).toBe('site-1')
    expect(forwarded.get('x-org-id')).toBe('org-1')
    expect(forwarded.get('x-default-locale')).toBe('pt-BR')
    expect(forwarded.get('x-site-timezone')).toBe('America/Sao_Paulo')
    expect(forwarded.get('x-locale')).toBe('en')
    expect(forwarded.has('x-primary-domain')).toBe(false)
    expect(forwarded.has('x-short-domain')).toBe(false)
    expect(forwarded.has('content-security-policy')).toBe(false)
  })

  it('keeps the go.* branch writing the real x-short-domain on the response', async () => {
    const { middleware } = await import('@/middleware')
    const res = await middleware(forgedRequest('/abc', 'go.bythiagofigueiredo.com'))
    expect(res.headers.get('x-middleware-rewrite')).toContain('/go/abc')
    expect(res.headers.get('x-short-domain')).toBe('go.bythiagofigueiredo.com')
    expect(forwardedRequestHeaders(res).has('x-short-domain')).toBe(false)
  })
})

/**
 * These pin that the RETIRED sink is closed: `src/app/go/route.ts` no longer
 * reads `x-short-domain` at all, so forging it is a no-op by construction —
 * these tests do NOT exercise the middleware and do NOT prove anything about
 * `x-primary-domain`, which the route *does* still consult (via
 * `getSiteContext`). That trust relationship is pinned separately below, by
 * a test that runs the real middleware.
 */
describe('GET /go: the retired x-short-domain header is a no-op (old sink stays closed)', () => {
  it('a forged x-short-domain is never read; destination comes from x-primary-domain/host', async () => {
    headersMock.mockResolvedValue(
      new Headers({
        host: 'bythiagofigueiredo.com',
        'x-site-id': 'site-1',
        'x-org-id': 'org-1',
        'x-default-locale': 'pt-BR',
        // Forjado: a versão pré-A4 lia isto em src/app/go/route.ts:4 e
        // redirecionava a evil.com. A rota atual nunca lê este header.
        'x-short-domain': 'go.evil.com',
      }),
    )
    const { GET } = await import('@/app/go/route')
    const res = await GET()
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://bythiagofigueiredo.com/')
  })

  it('a forged x-short-domain has no bearing on the no-site-resolved fallback', async () => {
    headersMock.mockResolvedValue(
      new Headers({ host: 'evil.com', 'x-short-domain': 'go.evil.com' }),
    )
    const { GET } = await import('@/app/go/route')
    const res = await GET()
    expect(res.headers.get('location')).toBe('https://bythiagofigueiredo.com/')
  })

  it('falls back to the canonical host on a local dev host (no x-short-domain involved)', async () => {
    headersMock.mockResolvedValue(
      new Headers({
        host: 'dev.localhost:3001',
        'x-site-id': 'site-1',
        'x-org-id': 'org-1',
      }),
    )
    const { GET } = await import('@/app/go/route')
    const res = await GET()
    expect(res.headers.get('location')).toBe('https://bythiagofigueiredo.com/')
  })
})

/**
 * THE test that pins the actual control. `src/app/go/route.ts` reads
 * `site.primaryDomain`, which `lib/cms/site-context.ts` derives as
 * `x-primary-domain ?? host` — `x-primary-domain` is itself a header, and by
 * itself just as forgeable as `x-short-domain` was. The route is safe only
 * because `src/middleware.ts` deletes `x-primary-domain` from every incoming
 * request (`STRIPPED_REQUEST_HEADERS`) before any handler runs. This test
 * proves that: it sends the forged header through the REAL `middleware()`
 * export (not a hand-built `Headers` object standing in for its output),
 * takes exactly what the middleware would forward to a route handler, and
 * only then calls `GET()` — so it fails if the strip in `src/middleware.ts`
 * is ever weakened, unlike the mock-only tests above.
 */
describe('GET /go: middleware strip is the actual control for x-primary-domain', () => {
  it('a forged x-primary-domain is stripped by the middleware before GET /go ever sees it', async () => {
    const { middleware } = await import('@/middleware')
    const request = new NextRequest(
      new URL('https://bythiagofigueiredo.com/go'),
      {
        headers: new Headers({
          host: 'bythiagofigueiredo.com',
          // Forjado: se este header sobrevivesse à borda, chegaria a
          // getSiteContext() como site.primaryDomain e o redirect abaixo
          // apontaria para https://evil.com — o mesmo bug de x-short-domain,
          // só que na fonte que substituiu ela.
          'x-primary-domain': 'evil.com',
        }),
      },
    )
    const middlewareResponse = await middleware(request)
    const forwarded = forwardedRequestHeaders(middlewareResponse)

    // Sanidade: prova que o strip realmente aconteceu neste caminho, antes
    // de confiar no comportamento da rota sobre esses headers.
    expect(forwarded.has('x-primary-domain')).toBe(false)

    headersMock.mockResolvedValue(
      new Headers(Object.fromEntries(forwarded.entries())),
    )
    const { GET } = await import('@/app/go/route')
    const res = await GET()
    expect(res.headers.get('location')).toBe('https://bythiagofigueiredo.com/')
  })
})
