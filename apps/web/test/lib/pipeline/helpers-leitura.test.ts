// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const cfg = vi.hoisted(() => ({ modo: 'aviso' as 'aviso' | 'recusa', avisoDesde: '2026-10-13', controleFechadoEm: null as string | null, conferenciaAte: null as string | null }))
vi.mock('@/lib/pipeline/leitura-modo', () => ({ modoLeitura: () => cfg }))
vi.mock('@/lib/pipeline/leitura-registro', () => ({ registrarLeitura: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/pipeline/auth', async (orig) => ({
  ...(await orig<typeof import('@/lib/pipeline/auth')>()),
  authenticatePipeline: vi.fn(),
}))

import { authenticateRead, authenticateWrite, authenticateIntel, authenticateReadOrIntel } from '@/lib/pipeline/helpers'
import { authenticatePipeline, type PipelineAuth } from '@/lib/pipeline/auth'
import { registrarLeitura } from '@/lib/pipeline/leitura-registro'

const req = new NextRequest('https://x.test/api/pipeline/stats')
const chave = (permissions: string[]): PipelineAuth => ({ siteId: 's', permissions, source: 'api_key', keyHash: 'h', keyId: 'k', keyName: 'n' })
const sessao: PipelineAuth = { siteId: 's', permissions: ['read', 'write'], source: 'session' }
const entra = (auth: PipelineAuth) => vi.mocked(authenticatePipeline).mockResolvedValue({ ok: true, auth })

beforeEach(() => { vi.clearAllMocks(); cfg.modo = 'aviso' })

describe('authenticateRead, modo aviso', () => {
  it('chave só com intelligence continua lendo E a leitura é registrada', async () => {
    entra(chave(['intelligence']))
    const r = await authenticateRead(req)
    expect(r).toEqual({ ok: true, auth: chave(['intelligence']) })
    expect(registrarLeitura).toHaveBeenCalledWith(req, chave(['intelligence']), 'aviso')
  })
  it('chave com read lê e é registrada (controle positivo)', async () => {
    entra(chave(['read']))
    expect(await authenticateRead(req)).toMatchObject({ ok: true })
    expect(registrarLeitura).toHaveBeenCalledWith(req, chave(['read']), 'aviso')
  })
  it('chave inválida: 401, sem registro', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: false, status: 401, error: 'Invalid or revoked API key' })
    const r = await authenticateRead(req)
    expect(r instanceof Response && r.status).toBe(401)
    expect(registrarLeitura).not.toHaveBeenCalled()
  })
})

describe('authenticateRead, modo recusa', () => {
  beforeEach(() => { cfg.modo = 'recusa' })
  it('chave só com intelligence: 403 com o corpo de authenticateWrite, e a recusa é registrada', async () => {
    entra(chave(['intelligence']))
    const r = await authenticateRead(req)
    expect(r instanceof Response && r.status).toBe(403)
    expect(await (r as Response).json()).toEqual({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } })
    expect(registrarLeitura).toHaveBeenCalledWith(req, chave(['intelligence']), 'recusada')
    entra(chave(['intelligence']))
    const w = await authenticateWrite(req)
    expect(await (w as Response).json()).toEqual({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } })
  })
  it('chave sem permissão nenhuma: 403', async () => {
    entra(chave([]))
    const r = await authenticateRead(req)
    expect(r instanceof Response && r.status).toBe(403)
  })
  it.each([['read'], ['write'], ['admin']])('chave com %s lê como antes', async (p) => {
    entra(chave([p]))
    expect(await authenticateRead(req)).toMatchObject({ ok: true })
  })
  it('sessão de usuário lê como antes', async () => {
    entra(sessao)
    expect(await authenticateRead(req)).toEqual({ ok: true, auth: sessao })
  })
  it('os outros helpers não mudam: intelligence passa em Intel e em ReadOrIntel', async () => {
    entra(chave(['intelligence']))
    expect(await authenticateIntel(req)).toMatchObject({ ok: true })
    entra(chave(['intelligence']))
    expect(await authenticateReadOrIntel(req)).toMatchObject({ ok: true })
  })
})

describe('403 da autenticação sai com o código FORBIDDEN, em todos os helpers (M2)', () => {
  const helpers = { authenticateRead, authenticateWrite, authenticateIntel, authenticateReadOrIntel } as const
  for (const [nome, h] of Object.entries(helpers)) {
    it(`${nome}: 403 do authenticatePipeline (perfil observatorio_leitura) -> FORBIDDEN`, async () => {
      vi.mocked(authenticatePipeline).mockResolvedValue({ ok: false, status: 403, error: 'Forbidden' })
      const r = await h(req)
      expect(r instanceof Response && r.status).toBe(403)
      expect(r instanceof Response && (await r.json())).toEqual({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    })
    it(`${nome}: 401 continua UNAUTHORIZED`, async () => {
      vi.mocked(authenticatePipeline).mockResolvedValue({ ok: false, status: 401, error: 'Unauthorized' })
      const r = await h(req)
      expect(r instanceof Response && (await r.json())).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } })
    })
  }
})
