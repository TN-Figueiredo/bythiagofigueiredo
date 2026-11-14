// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { captureMessage, captureException } = vi.hoisted(() => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage, captureException }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/youtube/observatorio/acesso-ia/interruptor', () => ({
  acessoExternoLigado: () => (process.env.OBSERVATORIO_IA_EXTERNA === 'on' ? { ligado: true } : { ligado: false, motivo: 'variavel' }),
}))
vi.mock('@/lib/pipeline/logger', () => ({ pipelineLog: vi.fn() }))

import { POST } from '../../../src/app/api/oauth/revoke/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { pipelineLog } from '@/lib/pipeline/logger'
import { createHash } from 'node:crypto'

function banco(erro: 'nenhum' | 'erro' | 'lanca' = 'nenhum') {
  const rpc = vi.fn(async (_f: string, _a: Record<string, string>) => {
    if (erro === 'lanca') throw new Error('boom')
    return { data: null, error: erro === 'erro' ? { code: '57014', message: 'segredo ort_zzz' } : null }
  })
  vi.mocked(getSupabaseServiceClient).mockReturnValue({ rpc } as never)
  return rpc
}
const req = (p: Record<string, string> | string, ct = 'application/x-www-form-urlencoded') =>
  new Request('https://bythiagofigueiredo.com/api/oauth/revoke', {
    method: 'POST', headers: { 'content-type': ct }, body: typeof p === 'string' ? p : new URLSearchParams(p).toString(),
  })

beforeEach(() => {
  process.env.OBSERVATORIO_IA_OAUTH = 'on'
  process.env.OBSERVATORIO_IA_EXTERNA = 'on'
  vi.mocked(pipelineLog).mockClear(); captureMessage.mockClear(); captureException.mockClear()
})
afterEach(() => {
  delete process.env.OBSERVATORIO_IA_OAUTH
  delete process.env.OBSERVATORIO_IA_EXTERNA
})

describe('POST /api/oauth/revoke', () => {
  it('revoga pelo hash e responde 200 vazio; hint é ignorado', async () => {
    const rpc = banco()
    const res = await POST(req({ token: 'ort_abc', token_type_hint: 'access_token' }))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('')
    expect(res.headers.get('cache-control')).toBe('no-store')
    const [fn, a] = rpc.mock.calls[0]
    expect(fn).toBe('obs_ai_revogar_token')
    expect(a.p_hash).toBe(createHash('sha256').update('ort_abc').digest('hex'))
  })

  it('token inexistente = 200; token ausente = 200 sem rpc', async () => {
    const rpc = banco()
    expect((await POST(req({ token: 'oat_naoexiste' }))).status).toBe(200)
    rpc.mockClear()
    expect((await POST(req({}))).status).toBe(200)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('M1: token sem prefixo oat_/ort_ = 200 sem rpc', async () => {
    const rpc = banco()
    expect((await POST(req({ token: 'lixo' }))).status).toBe(200)
    expect(rpc).not.toHaveBeenCalled()
    expect((await POST(req({ token: 'oat_ok' }))).status).toBe(200)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('trava fechada = 503 sem rpc', async () => {
    const rpc = banco()
    delete process.env.OBSERVATORIO_IA_EXTERNA
    expect((await POST(req({ token: 'x' }))).status).toBe(503)
    process.env.OBSERVATORIO_IA_EXTERNA = 'on'
    delete process.env.OBSERVATORIO_IA_OAUTH
    expect((await POST(req({ token: 'x' }))).status).toBe(503)
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each(['erro', 'lanca'] as const)('A2: erro de banco (%s) = 503 com Retry-After, log só com o código, sem o token', async (modo) => {
    banco(modo)
    const res = await POST(req({ token: 'ort_zzz' }))
    expect(res.status).toBe(503)
    expect(res.headers.get('retry-after')).toBe('5')
    expect(await res.json()).toEqual({ error: 'temporarily_unavailable' })
    expect(pipelineLog).toHaveBeenCalledTimes(1)
    const tudo = JSON.stringify([vi.mocked(pipelineLog).mock.calls, captureMessage.mock.calls, captureException.mock.calls])
    expect(tudo).toContain(modo === 'erro' ? '57014' : 'excecao')
    expect(tudo).not.toContain('ort_zzz')
    expect(tudo).not.toContain(createHash('sha256').update('ort_zzz').digest('hex'))
  })

  it('A6: Host fora da lista = 404 sem rpc', async () => {
    const rpc = banco()
    const r = new Request('https://bythiagofigueiredo.com/api/oauth/revoke', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', host: 'x.vercel.app' }, body: 'token=ort_a',
    })
    expect((await POST(r)).status).toBe(404)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('forma errada ou corpo grande = 200 sem rpc', async () => {
    const rpc = banco()
    expect((await POST(req('{"token":"x"}', 'application/json'))).status).toBe(200)
    expect((await POST(req('token=a&token=b'))).status).toBe(200)
    expect((await POST(req('token=' + 'x'.repeat(1024 * 1024)))).status).toBe(200)
    expect(rpc).not.toHaveBeenCalled()
  })
})
