// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * C1 T21 (K17): a tela de consentimento lê a sessão no Server Component, que não grava cookie. Quem renova o refresh vencido é o
 * middleware, e o cookie novo tem de ir (a) na RESPOSTA, para o navegador, e (b) na REQUISIÇÃO repassada, para o Server Component.
 * O `createAuthMiddleware` do pacote não renova em rota pública: o ramo usa `@supabase/ssr` direto.
 */

const LOCAL_ANON = 'anon-key-de-teste'
const { getUser, criados } = vi.hoisted(() => ({ getUser: vi.fn(), criados: [] as Array<{ cookies: { getAll(): Array<{ name: string; value: string }>; setAll(l: Array<{ name: string; value: string; options?: Record<string, unknown> }>): void } }> }))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@supabase/ssr', () => ({
  createServerClient: (_u: string, _k: string, o: (typeof criados)[number]) => {
    criados.push(o)
    return { auth: { getUser: () => getUser(o) } }
  },
}))
vi.mock('@tn-figueiredo/auth-nextjs/middleware', () => ({
  createAuthMiddleware: () => async () => {
    const { NextResponse } = await import('next/server')
    return NextResponse.next()
  },
}))
vi.mock('@tn-figueiredo/cms/ring', () => ({
  SupabaseRingContext: class {
    getSiteByDomain(domain: string) {
      return Promise.resolve(domain === 'bythiagofigueiredo.com'
        ? { id: 'site-1', org_id: 'org-1', default_locale: 'pt-BR', domains: [domain], supported_locales: ['pt-BR', 'en'], name: 'x', slug: 'x', created_at: '', updated_at: '', cms_enabled: true }
        : null)
    }
  },
}))

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', LOCAL_ANON)
  vi.stubEnv('CSP_NONCE_ENABLED', '')
  vi.stubEnv('CSP_NONCE_REPORT_ONLY', '')
})
afterAll(() => vi.unstubAllEnvs())
beforeEach(() => {
  criados.length = 0
  getUser.mockReset()
  // Auth simulado: o access_token vencido é trocado por um novo (o refresh válido), como faz o supabase-js.
  getUser.mockImplementation(async (o: (typeof criados)[number]) => {
    const velho = o.cookies.getAll().find((c) => c.name === 'sb-local-auth-token')
    if (velho?.value === 'vencido') o.cookies.setAll([{ name: 'sb-local-auth-token', value: 'renovado', options: { path: '/', httpOnly: true } }])
    return { data: { user: { id: 'u1' } }, error: null }
  })
})

const pedir = (path: string, cookie = 'sb-local-auth-token=vencido'): NextRequest =>
  new NextRequest(new URL(`https://bythiagofigueiredo.com${path}`), { headers: { host: 'bythiagofigueiredo.com', cookie } })

function repassados(res: Response): Map<string, string> {
  const out = new Map<string, string>()
  for (const k of (res.headers.get('x-middleware-override-headers') ?? '').split(',').map((s) => s.trim()).filter(Boolean)) out.set(k.toLowerCase(), res.headers.get(`x-middleware-request-${k}`) ?? '')
  return out
}

describe('middleware: /oauth/consentimento', () => {
  it('sem prefixo: CSP com frame-ancestors none, Set-Cookie novo e cookie repassado ao Server Component', async () => {
    const { middleware } = await import('@/middleware')
    const res = await middleware(pedir('/oauth/consentimento?authorization_id=x'))
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
    expect(res.headers.get('set-cookie') ?? '').toContain('sb-local-auth-token=renovado')
    const cab = repassados(res)
    expect(cab.get('cookie')).toContain('sb-local-auth-token=renovado')
    expect(cab.get('cookie')).not.toContain('vencido')
    expect(cab.get('x-site-id')).toBe('site-1')
    expect(cab.get('x-nonce')).toBeTruthy()
    expect(getUser).toHaveBeenCalledTimes(1)
  })

  it('com prefixo de locale (/pt): mesma renovação, e o rewrite para o caminho sem prefixo continua', async () => {
    const { middleware } = await import('@/middleware')
    const res = await middleware(pedir('/pt/oauth/consentimento?authorization_id=x'))
    expect(res.headers.get('x-middleware-rewrite')).toContain('/oauth/consentimento')
    expect(res.headers.get('x-middleware-rewrite')).not.toContain('/pt/')
    expect(res.headers.get('set-cookie') ?? '').toContain('sb-local-auth-token=renovado')
    const cab = repassados(res)
    expect(cab.get('cookie')).toContain('sb-local-auth-token=renovado')
    expect(cab.get('x-locale')).toBe('pt-BR')
    expect(cab.get('x-site-id')).toBe('site-1')
  })

  it('sessão válida (nada a renovar): cookie intacto e sem Set-Cookie', async () => {
    const { middleware } = await import('@/middleware')
    const res = await middleware(pedir('/oauth/consentimento?authorization_id=x', 'sb-local-auth-token=bom'))
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(repassados(res).get('cookie')).toBe('sb-local-auth-token=bom')
  })

  it('o Auth fora do ar não derruba a tela: segue sem renovar', async () => {
    getUser.mockRejectedValueOnce(new Error('rede'))
    const { middleware } = await import('@/middleware')
    const res = await middleware(pedir('/oauth/consentimento?authorization_id=x'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
  })

  it('outras rotas públicas não chamam o Auth (sem custo novo)', async () => {
    const { middleware } = await import('@/middleware')
    await middleware(pedir('/blog'))
    expect(getUser).not.toHaveBeenCalled()
  })

  it('x-frame-options DENY vem do bloco global do next.config (nenhuma linha nova para /oauth)', () => {
    const cfg = readFileSync(resolve(__dirname, '../../next.config.ts'), 'utf8')
    expect(cfg).toContain("source: '/((?!embed/waitlists/).*)'")
    expect(cfg).toContain("key: 'X-Frame-Options'")
    expect(cfg).not.toContain('/oauth')
  })
})
