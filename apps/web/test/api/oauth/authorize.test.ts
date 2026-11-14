// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHash } from 'crypto'

const { captureMessage } = vi.hoisted(() => ({ captureMessage: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn(async () => ({ siteId: 'site-1' })) }))
vi.mock('@/lib/pipeline/logger', () => ({ pipelineLog: vi.fn() }))

import { GET } from '../../../src/app/api/oauth/authorize/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { pipelineLog } from '@/lib/pipeline/logger'
import { __zerarAvisos } from '@/lib/youtube/observatorio/acesso-ia/oauth/aviso'

const SEGREDO = Buffer.alloc(32, 7).toString('base64')
const REDIR = 'https://claude.ai/api/mcp/auth_callback'
const CH = 'b'.repeat(43)

function banco(opts: { cliente?: boolean; falhaRpc?: boolean; falhaInsert?: boolean; falhaSelect?: boolean; diaAtual?: number } = {}) {
  const porHash = new Map<string, number>()
  let dia = opts.diaAtual ?? 0
  const insert = vi.fn(async () => ({ error: opts.falhaInsert ? { message: 'x' } : null }))
  const rpc = vi.fn(async (_f: string, a: { p_grain: string; p_hash: string; p_limite: number; p_teto_dia: number }) => {
    if (opts.falhaRpc) return { data: null, error: { code: 'XX000', message: 'x' } }
    const n = Math.min((porHash.get(a.p_hash) ?? 0) + 1, a.p_limite + 1)
    porHash.set(a.p_hash, n)
    if (n <= a.p_limite) dia = Math.min(dia + 1, a.p_teto_dia + 1)
    return { data: [{ n, n_dia: dia, estourou: false }], error: null }
  })
  const maybeSingle = vi.fn(async () => ({
    data: opts.cliente === false ? null : { redirect_uris: [REDIR] },
    error: opts.falhaSelect ? { message: 'x' } : null,
  }))
  const from = vi.fn((t: string) => (t === 'obs_ai_oauth_clientes' ? { select: () => ({ eq: () => ({ maybeSingle }) }) } : { insert }))
  return { rpc, from, insert }
}

function req(params: Record<string, string> = {}, o: { host?: string; ip?: string; sem?: string[] } = {}): Request {
  const q = new URLSearchParams({ client_id: 'cid', redirect_uri: REDIR, code_challenge: CH, code_challenge_method: 'S256', response_type: 'code', ...params })
  for (const k of o.sem ?? []) q.delete(k)
  return new Request(`https://${o.host ?? 'bythiagofigueiredo.com'}/api/oauth/authorize?${q}`, { headers: { 'x-forwarded-for': o.ip ?? '1.2.3.4' } })
}

beforeEach(() => {
  process.env.OBSERVATORIO_IA_OAUTH = 'on'
  process.env.OBSERVATORIO_IA_IP_SEGREDO = SEGREDO
  captureMessage.mockClear()
  vi.mocked(pipelineLog).mockClear()
  vi.mocked(getSiteContext).mockImplementation(async () => ({ siteId: 'site-1' }) as never)
  __zerarAvisos()
})
afterEach(() => {
  delete process.env.OBSERVATORIO_IA_OAUTH
  delete process.env.OBSERVATORIO_IA_IP_SEGREDO
  vi.unstubAllEnvs()
})

describe('GET /api/oauth/authorize', () => {
  it('válido: grava pedido (só sha256 do id) e 302 só com authorization_id', async () => {
    const b = banco()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(b as never)
    const res = await GET(req({ state: 'st' }))
    expect(res.status).toBe(302)
    const loc = new URL(res.headers.get('location')!, 'https://bythiagofigueiredo.com')
    expect(loc.pathname).toBe('/oauth/consentimento')
    expect([...loc.searchParams.keys()]).toEqual(['authorization_id'])
    const id = loc.searchParams.get('authorization_id')!
    expect(id).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const row = b.insert.mock.calls[0]?.[0] as unknown as Record<string, string>
    expect(row.hash).toBe(createHash('sha256').update(id).digest('hex'))
    expect(JSON.stringify(row)).not.toContain(id)
    expect(row).toMatchObject({ client_id: 'cid', redirect_uri: REDIR, code_challenge: CH, state: 'st', scope: 'observatorio:read', resource: 'https://bythiagofigueiredo.com/api/mcp', site_id: 'site-1' })
    const exp = Date.parse(row.expires_at as string) - Date.now()
    expect(exp).toBeGreaterThan(9 * 60_000)
    expect(exp).toBeLessThanOrEqual(10 * 60_000)
  })

  it('A1: o 302 de sucesso prende o pedido ao navegador (__Host-oauth_pedido)', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(banco() as never)
    const res = await GET(req({ state: 'st' }))
    const id = new URL(res.headers.get('location')!, 'https://bythiagofigueiredo.com').searchParams.get('authorization_id')!
    const sc = res.headers.get('set-cookie')!
    expect(sc.startsWith(`__Host-oauth_pedido=${id};`)).toBe(true)
    for (const parte of ['path=/', 'secure', 'httponly', 'samesite=lax', 'max-age=600']) expect(sc.toLowerCase()).toContain(parte)
    expect(sc.toLowerCase()).not.toContain('domain')
  })

  it('A1: resposta que não é o 302 de sucesso não leva o cookie', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(banco({ cliente: false }) as never)
    expect((await GET(req())).headers.get('set-cookie')).toBeNull()
  })

  it('scope e resource ausentes = aceito; offline_access observatorio:read aceito', async () => {
    const b = banco()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(b as never)
    expect((await GET(req({ scope: 'offline_access observatorio:read' }))).status).toBe(302)
    expect((await GET(req())).status).toBe(302)
    expect((b.insert.mock.calls[1]?.[0] as unknown as Record<string, string>).scope).toBe('observatorio:read')
  })

  it('client_id desconhecido = 200 com página, sem Location, sem insert', async () => {
    const b = banco({ cliente: false })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(b as never)
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
    expect(await res.text()).toContain('Esta conexão precisa ser refeita')
    expect(b.insert).not.toHaveBeenCalled()
  })

  it('redirect_uri fora do registrado = 200, sem Location', async () => {
    const b = banco()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(b as never)
    const res = await GET(req({ redirect_uri: 'https://evil.com/cb' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
    expect(b.insert).not.toHaveBeenCalled()
  })

  it.each([
    ['sem challenge', {}, ['code_challenge'], 'invalid_request'],
    ['método plain', { code_challenge_method: 'plain' }, [], 'invalid_request'],
    ['challenge curto', { code_challenge: 'x' }, [], 'invalid_request'],
    ['state grande', { state: 's'.repeat(513) }, [], 'invalid_request'],
    ['scope fora', { scope: 'admin' }, [], 'invalid_scope'],
    ['resource com barra', { resource: 'https://bythiagofigueiredo.com/api/mcp/' }, [], 'invalid_target'],
  ])('%s = 302 ao cliente com error, iss e state', async (_n, p, sem, erro) => {
    const b = banco()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(b as never)
    const res = await GET(req({ state: 'st1', ...p }, { sem }))
    expect(res.status).toBe(302)
    const loc = new URL(res.headers.get('location')!)
    expect(`${loc.origin}${loc.pathname}`).toBe(REDIR)
    expect(loc.searchParams.get('error')).toBe(erro)
    expect(loc.searchParams.get('iss')).toBe('https://bythiagofigueiredo.com')
    expect(loc.search).toContain('iss=https%3A%2F%2Fbythiagofigueiredo.com')
    expect(loc.searchParams.get('error_description')).toBeTruthy()
    if (erro !== 'invalid_request' || !p.state) expect(loc.searchParams.get('state')).toBe('st1')
    expect(b.insert).not.toHaveBeenCalled()
  })

  it('M5: redirect_uri repetido = 200 sem Location; code_challenge repetido = 302 invalid_request', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(banco() as never)
    const u1 = new URL(req().url); u1.searchParams.append('redirect_uri', 'https://evil.test/x')
    const r1 = await GET(new Request(u1, { headers: { 'x-forwarded-for': '1.2.3.4' } }))
    expect(r1.status).toBe(200)
    expect(r1.headers.get('location')).toBeNull()
    const u2 = new URL(req().url); u2.searchParams.append('code_challenge', CH)
    const r2 = await GET(new Request(u2, { headers: { 'x-forwarded-for': '1.2.3.5' } }))
    expect(r2.status).toBe(302)
    expect(new URL(r2.headers.get('location')!).searchParams.get('error')).toBe('invalid_request')
  })
  it('invalid_target traz a descrição', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(banco() as never)
    const res = await GET(req({ resource: 'https://bythiagofigueiredo.com/api/mcp/' }))
    expect(new URL(res.headers.get('location')!).searchParams.get('error_description')).toBe('use https://bythiagofigueiredo.com/api/mcp')
  })

  it('61o do IP/hora = 429 HTML; outro IP ok', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(banco() as never)
    for (let i = 0; i < 60; i++) expect((await GET(req())).status).toBe(302)
    const r = await GET(req())
    expect(r.status).toBe(429)
    expect(r.headers.get('content-type')).toContain('text/html')
    expect((await GET(req({}, { ip: '9.9.9.9' }))).status).toBe(302)
  })

  it('2.001o do dia = 429', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(banco({ diaAtual: 2000 }) as never)
    expect((await GET(req())).status).toBe(429)
  })

  it('host x.vercel.app = 404 sem gravar; localhost em produção = 404', async () => {
    const b = banco()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(b as never)
    expect((await GET(req({}, { host: 'x.vercel.app' }))).status).toBe(404)
    vi.stubEnv('NODE_ENV', 'production')
    expect((await GET(req({}, { host: 'localhost:3000' }))).status).toBe(404)
    expect(b.insert).not.toHaveBeenCalled()
    expect(b.rpc).not.toHaveBeenCalled()
  })

  it('trava apagada = 404; segredo ausente = 503', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(banco() as never)
    delete process.env.OBSERVATORIO_IA_IP_SEGREDO
    expect((await GET(req())).status).toBe(503)
    delete process.env.OBSERVATORIO_IA_OAUTH
    expect((await GET(req())).status).toBe(404)
  })

  it('falha do banco (rpc, select, insert, cliente) = 503', async () => {
    for (const o of [{ falhaRpc: true }, { falhaSelect: true }, { falhaInsert: true }]) {
      vi.mocked(getSupabaseServiceClient).mockReturnValue(banco(o) as never)
      expect((await GET(req())).status).toBe(503)
    }
    vi.mocked(getSupabaseServiceClient).mockImplementation(() => { throw new Error('env') })
    expect((await GET(req())).status).toBe(503)
  })

  it('503 é página HTML em português com c1-falha, sem texto cru', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(banco({ falhaRpc: true }) as never)
    const res = await GET(req())
    expect(res.status).toBe(503)
    expect(res.headers.get('content-type')).toContain('text/html')
    const h = await res.text()
    expect(h).toContain('c1-falha')
    expect(h).toContain('Não deu para conectar agora.')
    expect(h).not.toContain('temporarily_unavailable')
    delete process.env.OBSERVATORIO_IA_IP_SEGREDO
    const r2 = await GET(req())
    expect(r2.status).toBe(503)
    expect(await r2.text()).toContain('c1-falha')
  })

  it('state com <script> não aparece no HTML de erro', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(banco({ falhaRpc: true }) as never)
    const res = await GET(req({ state: '<script>alert(1)</script>' }))
    expect(res.status).toBe(503)
    const h = await res.text()
    expect(h).toContain('c1-falha')
    expect(h).not.toContain('<script>alert')
    expect(h).not.toContain('alert(1)')
  })

  it('I1: 503 loga etapa e code (rate, site, pedido), sem client_id nem IP', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(banco({ falhaRpc: true }) as never)
    expect((await GET(req({}, { ip: '9.8.7.6' }))).status).toBe(503)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(banco({ falhaSelect: true }) as never)
    expect((await GET(req({}, { ip: '9.8.7.6' }))).status).toBe(503)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(banco() as never)
    vi.mocked(getSiteContext).mockRejectedValue(new Error('sem site'))
    expect((await GET(req({}, { ip: '9.8.7.6' }))).status).toBe(503)
    vi.mocked(getSiteContext).mockImplementation(async () => ({ siteId: 'site-1' }) as never)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(banco({ falhaInsert: true }) as never)
    expect((await GET(req({}, { ip: '9.8.7.6' }))).status).toBe(503)
    const c = vi.mocked(pipelineLog).mock.calls
    expect(c.map((x) => [x[0], x[1], x[2]])).toEqual([
      ['error', 'oauth-authorize', 'rate'], ['error', 'oauth-authorize', 'cliente'], ['error', 'oauth-authorize', 'site'], ['error', 'oauth-authorize', 'pedido'],
    ])
    expect(c[0][3]).toEqual({ code: 'XX000' })
    expect(c[1][3]).toEqual({ code: 'sem_codigo' })
    expect(c[2][3]).toEqual({ code: 'excecao' })
    const tudo = JSON.stringify(c)
    expect(tudo).not.toContain('"cid"')
    expect(tudo).not.toContain('9.8.7.6')
  })

  it.each([[{ response_type: 'token' }, undefined], [{}, 'response_type']] as const)('A5: response_type %j errado ou ausente = 302 unsupported_response_type com iss', async (p, sem) => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(banco() as never)
    const res = await GET(req(p, { sem: sem ? [sem] : [] }))
    expect(res.status).toBe(302)
    const u = new URL(res.headers.get('location') as string)
    expect(u.origin + u.pathname).toBe(REDIR)
    expect(u.searchParams.get('error')).toBe('unsupported_response_type')
    expect(u.searchParams.get('iss')).toBeTruthy()
  })

  it('A5: response_type repetido = invalid_request', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(banco() as never)
    const q = new URLSearchParams({ client_id: 'cid', redirect_uri: REDIR, code_challenge: CH, code_challenge_method: 'S256' })
    q.append('response_type', 'code'); q.append('response_type', 'code')
    const res = await GET(new Request(`https://bythiagofigueiredo.com/api/oauth/authorize?${q}`, { headers: { 'x-forwarded-for': '1.2.3.4' } }))
    expect(new URL(res.headers.get('location') as string).searchParams.get('error')).toBe('invalid_request')
  })
})
