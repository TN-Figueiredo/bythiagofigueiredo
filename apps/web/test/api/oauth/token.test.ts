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
import { __zerarAvisos } from '@/lib/youtube/observatorio/acesso-ia/oauth/aviso'
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
function banco(opts: { motivo?: string | null; erro?: boolean; lanca?: boolean; duracaoS?: number; semExpira?: boolean; codeErro?: string } = {}) {
  const rpc = vi.fn(async (_f: string, _a: Args) => {
    if (opts.lanca) throw new Error('boom')
    if (opts.erro) return { data: null, error: { code: opts.codeErro ?? '40001', message: 'x' } }
    if (opts.semExpira) return { data: [{ motivo: null, acesso_expira: null, refresh_expira: null }], error: null }
    if (opts.motivo) return { data: [{ motivo: opts.motivo, acesso_expira: null, refresh_expira: null }], error: null }
    return { data: [{ motivo: null, acesso_expira: new Date(Date.now() + (opts.duracaoS ?? 3600) * 1000).toISOString(), refresh_expira: 'b' }], error: null }
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

  it('M1: code sem oac_ e refresh sem ort_ = 400 invalid_grant sem rpc', async () => {
    const rpc = banco()
    for (const corpo of [{ ...CODIGO, code: 'xyz' }, { ...REFRESH, refresh_token: 'xyz' }, { ...REFRESH, refresh_token: 'oat_abc' }]) {
      const res = await POST(req(corpo))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe('invalid_grant')
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it('M2/M6: error_description ASCII; Pragma no-cache no 200 e nos erros', async () => {
    banco()
    const ok = /^[\x20-\x21\x23-\x5B\x5D-\x7E]*$/
    for (const corpo of ['json{', { grant_type: 'refresh_token' }, {}]) {
      const res = await POST(req(corpo as never))
      const d = (await res.json()).error_description as string | undefined
      if (d !== undefined) expect(ok.test(d)).toBe(true)
    }
    const res = await POST(req(REFRESH))
    expect(res.status).toBe(200)
    expect(res.headers.get('pragma')).toBe('no-cache')
    expect(res.headers.get('cache-control')).toBe('no-store')
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

  it('M3: expires_in vem de acesso_expira do banco (piso, mínimo 1)', async () => {
    banco({ duracaoS: 1800 })
    const a = await (await POST(req(CODIGO))).json()
    expect(a.expires_in).toBeGreaterThanOrEqual(1799)
    expect(a.expires_in).toBeLessThanOrEqual(1800)
    banco({ duracaoS: -5 })
    expect((await (await POST(req(REFRESH))).json()).expires_in).toBe(1)
  })

  it('M3: acesso_expira nulo no sucesso = 503', async () => {
    banco({ semExpira: true })
    const res = await POST(req(CODIGO))
    expect(res.status).toBe(503)
    expect(vi.mocked(pipelineLog).mock.calls[0]?.[3]).toEqual({ code: 'linha_invalida' })
  })

  it.each([
    ['erro', { erro: true, codeErro: 'XX000' }, 'XX000'],
    ['lanca', { lanca: true }, 'excecao'],
  ] as const)('I1: 503 (%s) gera pipelineLog com etapa e code, sem segredo', async (_n, o, code) => {
    banco({ ...o })
    expect((await POST(req(REFRESH))).status).toBe(503)
    expect(pipelineLog).toHaveBeenCalledTimes(1)
    const [nivel, , etapa, extra] = vi.mocked(pipelineLog).mock.calls[0]
    expect(nivel).toBe('error')
    expect(etapa).toBe('giro')
    expect(extra).toEqual({ code })
    const tudo = JSON.stringify(vi.mocked(pipelineLog).mock.calls)
    for (const x of ['cli-secreto', 'ort_xyz', sha('ort_xyz')]) expect(tudo).not.toContain(x)
  })

  it('I1: etapa troca na troca de código', async () => {
    banco({ erro: true })
    await POST(req(CODIGO))
    expect(vi.mocked(pipelineLog).mock.calls[0]?.[2]).toBe('troca')
  })

  it('A3: reuso_familia e reuso_carencia avisam o Sentry e logam só o motivo', async () => {
    for (const m of ['reuso_familia', 'reuso_carencia']) {
      captureMessage.mockClear(); vi.mocked(pipelineLog).mockClear()
      __zerarAvisos()
      banco({ motivo: m })
      const res = await POST(req(REFRESH))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe('invalid_grant')
      expect(captureMessage).toHaveBeenCalledTimes(1)
      expect(captureMessage.mock.calls[0][1].tags.tipo).toBe('reuso_refresh')
      expect(vi.mocked(pipelineLog).mock.calls[0]).toEqual(['warn', 'oauth-token', 'reuso de refresh', { motivo: m }])
      const tudo = JSON.stringify([captureMessage.mock.calls, vi.mocked(pipelineLog).mock.calls])
      for (const x of ['cli-secreto', 'ort_xyz', sha('ort_xyz')]) expect(tudo).not.toContain(x)
    }
  })

  it('A3: invalid_grant comum não avisa', async () => {
    banco({ motivo: 'invalid_grant' })
    expect((await POST(req(REFRESH))).status).toBe(400)
    expect(captureMessage).not.toHaveBeenCalled()
    expect(pipelineLog).not.toHaveBeenCalled()
  })

  it('A6: Host fora da lista = 404 sem rpc', async () => {
    const rpc = banco()
    const r = new Request('https://x.vercel.app/api/oauth/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', host: 'x.vercel.app' }, body: new URLSearchParams(CODIGO).toString(),
    })
    expect((await POST(r)).status).toBe(404)
    expect(rpc).not.toHaveBeenCalled()
  })
})
