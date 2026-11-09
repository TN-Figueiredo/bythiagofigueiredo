// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * A2 · Tarefa 4: a porta de papel do CMS. Fora do Observatório, `/cms/*` pergunta `can_edit_site(site do host)` com a sessão de quem pede;
 * `false`, erro ou site ausente mandam para o Painel (307). Os cookies renovados pelo cmsAuth têm de chegar à RPC.
 */
const { rpcCalls, rpcResult, captureException, authRes } = vi.hoisted(() => ({
  rpcCalls: [] as Array<{ name: string; args: unknown; token: string | null }>,
  rpcResult: { current: { data: true, error: null } as { data: unknown; error: unknown } },
  captureException: vi.fn(),
  authRes: { renovar: false, status: 200 },
}))

vi.mock('@sentry/nextjs', () => ({ captureException, captureMessage: vi.fn() }))
vi.mock('@supabase/ssr', () => ({
  createServerClient: (_u: string, _k: string, o: { cookies: { getAll: () => Array<{ name: string; value: string }> } }) => ({
    rpc: async (name: string, args: unknown) => {
      const token = o.cookies.getAll().find((c) => c.name === 'sb-test-auth-token')?.value ?? null
      rpcCalls.push({ name, args, token })
      return rpcResult.current
    },
  }),
}))
vi.mock('@tn-figueiredo/auth-nextjs/middleware', () => ({
  createAuthMiddleware: () => async () => {
    const { NextResponse } = await import('next/server')
    if (authRes.status >= 300) return NextResponse.redirect('https://a.test/cms/login', authRes.status)
    const r = NextResponse.next()
    if (authRes.renovar) r.cookies.set('sb-test-auth-token', 'NOVO')
    return r
  },
}))
vi.mock('@tn-figueiredo/cms/ring', () => ({
  SupabaseRingContext: class {
    constructor(_c: unknown) {}
    getSiteByDomain(d: string) {
      return Promise.resolve(d === 'a.test' ? { id: 'site-a', org_id: 'org-1', default_locale: 'pt-BR', domains: ['a.test'], supported_locales: ['pt-BR', 'en'], name: 'A', slug: 'a', created_at: '', updated_at: '', cms_enabled: true } : null)
    }
  },
}))

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
})
afterAll(() => { vi.unstubAllEnvs() })
beforeEach(() => { rpcCalls.length = 0; rpcResult.current = { data: false, error: null }; authRes.renovar = false; authRes.status = 200; captureException.mockClear() })

const pedir = (path: string, cookie = 'sb-test-auth-token=VELHO') =>
  new NextRequest(new URL(`https://a.test${path}`), { headers: { host: 'a.test', cookie } })
async function rodar(path: string, cookie?: string) {
  const { middleware } = await import('@/middleware')
  return middleware(pedir(path, cookie))
}
const destino = (res: Response) => (res.status === 307 ? new URL(res.headers.get('location')!).pathname : null)

describe('caminhoAbertoAoReporter (pura)', () => {
  it.each([
    ['/cms/youtube/competitors', true], ['/cms/youtube/competitors/canal/abc', true], ['/cms/youtube/competitors/arquivo', true],
    ['/cms/youtube/competitorsx', false], ['/cms/youtube/ab-lab', false], ['/cms', false], ['/cms/contacts/1', false],
    ['/cms/login', true], ['/cms/logout', true], ['/cms/forgot', true], ['/cms/disabled', true], ['/cms/reset', true], ['/cms/reset/xyz', true],
    ['/cms/login/x', false],
  ])('%s -> %s', async (p, esperado) => {
    const { caminhoAbertoAoReporter } = await import('@/lib/cms/porta-do-papel')
    expect(caminhoAbertoAoReporter(p)).toBe(esperado)
  })
})

describe('middleware: a porta de papel', () => {
  it.each(['/cms', '/cms/contacts/1', '/cms/youtube/ab-lab', '/cms/youtube/competitorsx', '/cms/pipeline/formato-com-texto', '/cms/arquivo.png'])(
    'quem não edita em %s -> 307 para o Painel', async (p) => {
      rpcResult.current = { data: false, error: null }
      const res = await rodar(p)
      expect(destino(res)).toBe('/cms/youtube/competitors')
      expect(rpcCalls).toEqual([{ name: 'can_edit_site', args: { p_site_id: 'site-a' }, token: 'VELHO' }])
    })

  it('o Painel e a página do canal seguem sem chamar a RPC (aberto ao reporter)', async () => {
    for (const p of ['/cms/youtube/competitors', '/cms/youtube/competitors/canal/abc', '/cms/login']) {
      const res = await rodar(p)
      expect(res.status, p).not.toBe(307)
    }
    expect(rpcCalls).toEqual([])
  })

  it('/pt/cms/youtube/competitors segue; /pt/cms/contacts (reporter) -> 307', async () => {
    expect((await rodar('/pt/cms/youtube/competitors')).status).not.toBe(307)
    expect(rpcCalls).toEqual([])
    expect(destino(await rodar('/pt/cms/contacts'))).toBe('/cms/youtube/competitors')
  })

  it('editor segue (RPC true)', async () => {
    rpcResult.current = { data: true, error: null }
    const res = await rodar('/cms/contacts/1')
    expect(res.status).not.toBe(307)
    expect(rpcCalls).toHaveLength(1)
  })

  it('vínculo só no site B, x-site-id = site A: a RPC devolve false para o site do host -> 307', async () => {
    rpcResult.current = { data: false, error: null }
    expect(destino(await rodar('/cms/campaigns'))).toBe('/cms/youtube/competitors')
    expect(rpcCalls[0]!.args).toEqual({ p_site_id: 'site-a' })
  })

  it('erro na RPC -> 307 e Sentry', async () => {
    rpcResult.current = { data: null, error: { code: '57014' } }
    expect(destino(await rodar('/cms/blog'))).toBe('/cms/youtube/competitors')
    expect(captureException).toHaveBeenCalledTimes(1)
  })

  it('resposta que não é boolean true fecha', async () => {
    rpcResult.current = { data: 'true', error: null }
    expect(destino(await rodar('/cms/blog'))).toBe('/cms/youtube/competitors')
  })

  it('cookie renovado pelo cmsAuth: a RPC recebe o token NOVO e o editor segue', async () => {
    authRes.renovar = true
    rpcResult.current = { data: true, error: null }
    const res = await rodar('/cms/blog')
    expect(res.status).not.toBe(307)
    expect(rpcCalls[0]!.token).toBe('NOVO')
  })

  it('o redirect da porta leva o cookie renovado', async () => {
    authRes.renovar = true
    const res = await rodar('/cms/blog')
    expect(destino(res)).toBe('/cms/youtube/competitors')
    expect(res.headers.get('set-cookie')).toContain('sb-test-auth-token=NOVO')
  })

  it('cmsAuth que já redirecionou (sem sessão): a porta não pergunta nada', async () => {
    authRes.status = 307
    const res = await rodar('/cms/blog')
    expect(new URL(res.headers.get('location')!).pathname).toBe('/cms/login')
    expect(rpcCalls).toEqual([])
  })

  it('/api/* não passa pela porta', async () => {
    const res = await rodar('/api/links/abc/stream')
    expect(res.status).not.toBe(307)
    expect(rpcCalls).toEqual([])
  })
})

describe('middleware: matcher', () => {
  it('a união cobre /cms/:path* além do matcher geral', async () => {
    const { config } = await import('@/middleware')
    expect(config.matcher).toContain('/cms/:path*')
    expect(config.matcher.length).toBeGreaterThanOrEqual(2)
  })
})
