// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { captureMessage } = vi.hoisted(() => ({ captureMessage: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))

import { POST } from '../../../src/app/api/oauth/register/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { __zerarAvisos } from '@/lib/youtube/observatorio/acesso-ia/oauth/aviso'

const SEGREDO = Buffer.alloc(32, 7).toString('base64')

type Linha = { n: number; n_dia: number; estourou: boolean }
function banco(opts: { falhaRpc?: boolean; falhaInsert?: boolean; diaAtual?: number } = {}) {
  const porHash = new Map<string, number>()
  let dia = opts.diaAtual ?? 0
  const insert = vi.fn(async () => ({ error: opts.falhaInsert ? { message: 'x' } : null }))
  const rpc = vi.fn(async (_f: string, a: { p_hash: string; p_limite: number; p_teto_dia: number }) => {
    if (opts.falhaRpc) return { data: null, error: { message: 'x' } }
    const n = Math.min((porHash.get(a.p_hash) ?? 0) + 1, a.p_limite + 1)
    porHash.set(a.p_hash, n)
    if (n <= a.p_limite) dia = Math.min(dia + 1, a.p_teto_dia + 1)
    const l: Linha = { n, n_dia: dia, estourou: false }
    return { data: [l], error: null }
  })
  const from = vi.fn(() => ({ insert }))
  return { rpc, from, insert }
}

function req(body: unknown, ip = '1.2.3.4', raw = false): Request {
  return new Request('https://bythiagofigueiredo.com/api/oauth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: raw ? (body as string) : JSON.stringify(body),
  })
}
const OK = { redirect_uris: ['https://claude.ai/api/mcp/auth_callback'], client_name: 'x', contacts: ['a@b.c'], logo_uri: 'https://e.com/l.png' }

beforeEach(() => {
  process.env.OBSERVATORIO_IA_OAUTH = 'on'
  process.env.OBSERVATORIO_IA_IP_SEGREDO = SEGREDO
  captureMessage.mockClear()
  __zerarAvisos()
})
afterEach(() => {
  delete process.env.OBSERVATORIO_IA_OAUTH
  delete process.env.OBSERVATORIO_IA_IP_SEGREDO
})

describe('POST /api/oauth/register', () => {
  it.each([
    ['https://chatgpt.com/connector_platform_oauth_redirect', 'chatgpt'],
    ['https://chatgpt.com/connector/oauth/abc_123-X', 'chatgpt'],
    ['https://claude.ai/api/mcp/auth_callback', 'claude'],
    ['https://claude.com/api/mcp/auth_callback', 'claude'],
  ])('aceita %s e grava só redirect_uris e cliente', async (uri, cliente) => {
    const b = banco()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(b as never)
    const res = await POST(req({ ...OK, redirect_uris: [uri] }))
    expect(res.status).toBe(201)
    const j = await res.json()
    expect(j.redirect_uris).toEqual([uri])
    expect(j.token_endpoint_auth_method).toBe('none')
    expect(j.grant_types).toEqual(['authorization_code', 'refresh_token'])
    expect(j.response_types).toEqual(['code'])
    expect(j.client_id).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(b.from).toHaveBeenCalledWith('obs_ai_oauth_clientes')
    const obj = b.insert.mock.calls[0]?.[0] as Record<string, unknown>
    expect(Object.keys(obj).sort()).toEqual(['client_id', 'cliente', 'redirect_uris'])
    expect(obj.cliente).toBe(cliente)
    expect(obj.redirect_uris).toEqual([uri])
    expect(JSON.stringify(j)).not.toContain('client_name')
  })

  it('redirect fora da lista = 400 invalid_redirect_uri sem gravar', async () => {
    const b = banco()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(b as never)
    const res = await POST(req({ redirect_uris: ['https://evil.com/cb'] }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_redirect_uri')
    expect(b.insert).not.toHaveBeenCalled()
  })

  it('mistura de clientes = 400', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(banco() as never)
    const res = await POST(req({ redirect_uris: ['https://claude.ai/api/mcp/auth_callback', 'https://chatgpt.com/connector_platform_oauth_redirect'] }))
    expect(res.status).toBe(400)
  })

  it('31o do mesmo IP na hora = 429; outro IP aceito', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(banco() as never)
    for (let i = 0; i < 30; i++) expect((await POST(req(OK))).status).toBe(201)
    const r = await POST(req(OK))
    expect(r.status).toBe(429)
    expect(await r.json()).toEqual({ error: 'rate_limited' })
    expect((await POST(req(OK, '9.9.9.9'))).status).toBe(201)
  })

  it('201o do dia = 429', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(banco({ diaAtual: 200 }) as never)
    const r = await POST(req(OK))
    expect(r.status).toBe(429)
  })

  it('100 recusas = 1 Sentry', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(banco() as never)
    for (let i = 0; i < 30; i++) await POST(req(OK))
    for (let i = 0; i < 100; i++) await POST(req(OK))
    expect(captureMessage).toHaveBeenCalledTimes(1)
  })

  it('segredo ausente = 503 e nenhum rpc', async () => {
    const b = banco()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(b as never)
    delete process.env.OBSERVATORIO_IA_IP_SEGREDO
    const r = await POST(req(OK))
    expect(r.status).toBe(503)
    expect((await r.json()).error).toBe('temporarily_unavailable')
    expect(b.rpc).not.toHaveBeenCalled()
    expect(b.insert).not.toHaveBeenCalled()
  })

  it('trava apagada = 404', async () => {
    delete process.env.OBSERVATORIO_IA_OAUTH
    const r = await POST(req(OK))
    expect(r.status).toBe(404)
  })

  it('falha do banco (rpc ou insert) = 503', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(banco({ falhaRpc: true }) as never)
    expect((await POST(req(OK))).status).toBe(503)
    vi.mocked(getSupabaseServiceClient).mockReturnValue(banco({ falhaInsert: true }) as never)
    expect((await POST(req(OK))).status).toBe(503)
    vi.mocked(getSupabaseServiceClient).mockImplementation(() => { throw new Error('env') })
    expect((await POST(req(OK))).status).toBe(503)
  })

  it('corpo > 8 KB = 413 (content-length e bytes lidos)', async () => {
    const b = banco()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(b as never)
    const grande = JSON.stringify({ ...OK, client_name: 'a'.repeat(9000) })
    expect((await POST(req(grande, '1.2.3.4', true))).status).toBe(413)
    const semCL = new Request('https://x/api/oauth/register', { method: 'POST', body: grande })
    expect((await POST(semCL)).status).toBe(413)
    expect(b.rpc).not.toHaveBeenCalled()
  })

  it('JSON inválido ou não-objeto = 400 invalid_client_metadata', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(banco() as never)
    for (const raw of ['{nao', '[1]', '"x"', 'null']) {
      const r = await POST(req(raw, '1.2.3.4', true))
      expect(r.status).toBe(400)
      expect((await r.json()).error).toBe('invalid_client_metadata')
    }
  })
})
