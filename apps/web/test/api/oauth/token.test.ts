// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { captureMessage, captureException } = vi.hoisted(() => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage, captureException }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
const { externa } = vi.hoisted(() => ({ externa: { ligado: true } }))
vi.mock('@/lib/youtube/observatorio/acesso-ia/interruptor', () => ({
  acessoExternoLigado: () => (process.env.OBSERVATORIO_IA_EXTERNA === 'on' && externa.ligado ? { ligado: true } : { ligado: false, motivo: 'variavel' }),
}))
vi.mock('@/lib/pipeline/logger', () => ({ pipelineLog: vi.fn() }))

import { createHash } from 'node:crypto'
import { POST } from '../../../src/app/api/oauth/token/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { pipelineLog } from '@/lib/pipeline/logger'
import { novoToken, s256 } from '@/lib/youtube/observatorio/acesso-ia/oauth/tokens'
import { credencialDe } from '@/lib/youtube/observatorio/acesso-ia/oauth/resolver'

const sha = (t: string) => createHash('sha256').update(t).digest('hex')
const VERIFIER = 'A'.repeat(43)
const CODIGO = {
  grant_type: 'authorization_code', code: 'oac_abc', code_verifier: VERIFIER,
  client_id: 'cli-secreto', redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
}
const REFRESH = { grant_type: 'refresh_token', refresh_token: 'ort_xyz', client_id: 'cli-secreto' }

type Args = Record<string, string>
function banco(opts: { motivo?: string | null; erro?: boolean; lanca?: boolean } = {}) {
  const rpc = vi.fn(async (_f: string, _a: Args) => {
    if (opts.lanca) throw new Error('boom')
    if (opts.erro) return { data: null, error: { code: '40001', message: 'x' } }
    if (opts.motivo) return { data: [{ motivo: opts.motivo, acesso_expira: null, refresh_expira: null }], error: null }
    return { data: [{ motivo: null, acesso_expira: 'a', refresh_expira: 'b' }], error: null }
  })
  vi.mocked(getSupabaseServiceClient).mockReturnValue({ rpc } as never)
  return rpc
}
function req(p: Record<string, string> | string, headers: Record<string, string> = {}): Request {
  const body = typeof p === 'string' ? p : new URLSearchParams(p).toString()
  return new Request('https://bythiagofigueiredo.com/api/oauth/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers }, body,
  })
}

beforeEach(() => {
  process.env.OBSERVATORIO_IA_OAUTH = 'on'
  process.env.OBSERVATORIO_IA_EXTERNA = 'on'
  externa.ligado = true
  vi.mocked(pipelineLog).mockClear(); captureMessage.mockClear(); captureException.mockClear()
})
afterEach(() => {
  delete process.env.OBSERVATORIO_IA_OAUTH
  delete process.env.OBSERVATORIO_IA_EXTERNA
})

describe('POST /api/oauth/token', () => {
  it('C1-9: troca de código devolve o par, scope fixo e expires_in 3600; o banco recebe só hashes', async () => {
    const rpc = banco()
    const res = await POST(req({ ...CODIGO, scope: 'observatorio:read offline_access', resource: 'https://bythiagofigueiredo.com/api/mcp' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const j = await res.json()
    expect(j.token_type).toBe('Bearer')
    expect(j.scope).toBe('observatorio:read')
    expect(j.expires_in).toBe(3600)
    expect(j.access_token).toMatch(/^oat_/)
    expect(j.refresh_token).toMatch(/^ort_/)
    const [fn, a] = rpc.mock.calls[0]
    expect(fn).toBe('obs_ai_trocar_codigo')
    expect(a.p_client).toBe('cli-secreto')
    expect(a.p_redirect).toBe(CODIGO.redirect_uri)
    expect(a.p_verifier_s256).toBe(s256(VERIFIER))
    expect(a.p_hash).toBe(sha('oac_abc'))
    expect(a.p_acesso_hash).toBe(sha(j.access_token))
    expect(a.p_refresh_hash).toBe(sha(j.refresh_token))
    expect(JSON.stringify(a)).not.toContain(j.access_token)
    expect(JSON.stringify(a)).not.toContain(j.refresh_token)
  })

  it('C1-10: refresh devolve o par novo e expires_in 3600', async () => {
    const rpc = banco()
    const res = await POST(req(REFRESH))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.expires_in).toBe(3600)
    expect(j.access_token).toMatch(/^oat_/)
    expect(j.refresh_token).toMatch(/^ort_/)
    const [fn, a] = rpc.mock.calls[0]
    expect(fn).toBe('obs_ai_girar_refresh')
    expect(a.p_client).toBe('cli-secreto')
    expect(a.p_novo_acesso).toHaveLength(64)
    expect(a.p_novo_refresh).toHaveLength(64)
  })

  it.each(['invalid_grant', 'reuso_carencia', 'reuso_familia'])('motivo %s = 400 invalid_grant', async (motivo) => {
    banco({ motivo })
    const res = await POST(req(REFRESH))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_grant')
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it.each(['client_id', 'redirect_uri', 'code', 'code_verifier'])('%s ausente = 400 invalid_request, sem rpc', async (k) => {
    const rpc = banco()
    const { [k]: _omit, ...resto } = CODIGO as Record<string, string>
    const res = await POST(req(resto))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_request')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('code_verifier fora da regex = invalid_request', async () => {
    const rpc = banco()
    for (const v of ['curto', 'A'.repeat(129), 'A'.repeat(42) + '!']) {
      const res = await POST(req({ ...CODIGO, code_verifier: v }))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe('invalid_request')
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it('refresh sem refresh_token ou client_id = invalid_request', async () => {
    banco()
    expect((await (await POST(req({ grant_type: 'refresh_token', client_id: 'c' }))).json()).error).toBe('invalid_request')
    expect((await (await POST(req({ grant_type: 'refresh_token', refresh_token: 'ort_x' }))).json()).error).toBe('invalid_request')
  })

  it('resource diferente = invalid_target; igual passa', async () => {
    const rpc = banco()
    const res = await POST(req({ ...CODIGO, resource: 'https://outro.example/api/mcp' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_target')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('grant_type desconhecido ou ausente', async () => {
    banco()
    const a = await POST(req({ grant_type: 'password' }))
    expect(a.status).toBe(400)
    expect((await a.json()).error).toBe('unsupported_grant_type')
    expect((await (await POST(req({}))).json()).error).toBe('invalid_request')
  })

  it('C1-2: OAuth apagada = 503 sem rpc', async () => {
    const rpc = banco()
    delete process.env.OBSERVATORIO_IA_OAUTH
    const res = await POST(req(REFRESH))
    expect(res.status).toBe(503)
    expect((await res.json()).error).toBe('temporarily_unavailable')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('C1-2: EXTERNA apagada com OAuth on = 503 sem rpc; religada, o MESMO refresh gira', async () => {
    const rpc = banco()
    delete process.env.OBSERVATORIO_IA_EXTERNA
    expect((await POST(req(REFRESH))).status).toBe(503)
    expect(rpc).not.toHaveBeenCalled()
    process.env.OBSERVATORIO_IA_EXTERNA = 'on'
    expect((await POST(req(REFRESH))).status).toBe(200)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0][0]).toBe('obs_ai_girar_refresh')
  })

  it('C1-20: rpc lança ou devolve erro = 503', async () => {
    banco({ lanca: true })
    const a = await POST(req(REFRESH))
    expect(a.status).toBe(503)
    expect(JSON.stringify(await a.json())).not.toContain('access_token')
    banco({ erro: true })
    expect((await POST(req(CODIGO))).status).toBe(503)
  })

  it('Foco 3: charset aceito; json, multipart, repetido e 1 MB recusados sem rpc', async () => {
    const rpc = banco()
    const ok = await POST(req(new URLSearchParams(REFRESH).toString(), { 'content-type': 'Application/X-WWW-Form-Urlencoded;charset=UTF-8' }))
    expect(ok.status).toBe(200)
    rpc.mockClear()
    const json = await POST(req(JSON.stringify(REFRESH), { 'content-type': 'application/json' }))
    expect(json.status).toBe(400)
    const multi = await POST(req('x', { 'content-type': 'multipart/form-data; boundary=x' }))
    expect(multi.status).toBe(400)
    const rep = await POST(req('grant_type=refresh_token&grant_type=refresh_token&refresh_token=a&client_id=b'))
    expect(rep.status).toBe(400)
    const grande = await POST(req('a=' + 'x'.repeat(1024 * 1024)))
    expect(grande.status).toBe(413)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('o código novo (oac_) é classificado como outra por credencialDe', () => {
    const { texto } = novoToken('oac_')
    expect(texto).toMatch(/^oac_[A-Za-z0-9_-]{43}$/)
    const r = new Request('https://x.test/api/mcp', { headers: { authorization: `Bearer ${texto}` } })
    expect(credencialDe(r)).toEqual({ tipo: 'outra' })
  })

  it('nada de token, hash ou client_id em log ou Sentry', async () => {
    banco({ lanca: true })
    await POST(req(REFRESH))
    banco({ motivo: 'invalid_grant' })
    await POST(req(REFRESH))
    const tudo = JSON.stringify([vi.mocked(pipelineLog).mock.calls, captureMessage.mock.calls, captureException.mock.calls])
    expect(tudo).not.toContain('cli-secreto')
    expect(tudo).not.toContain('ort_xyz')
  })
})
