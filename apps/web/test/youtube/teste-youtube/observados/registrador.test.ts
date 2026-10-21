// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ schema: vi.fn(), obs: vi.fn() }))
vi.mock('@/lib/youtube/competitor-health', () => ({ schemaTablesReady: mocks.schema }))
vi.mock('@/lib/youtube/teste-youtube/observados/passo', () => ({ rodarObservados: mocks.obs }))

import { rodarRegistro } from '@/lib/youtube/teste-youtube/registro/tarefa'
import { contexto, mundo } from '../registro/mundo'

beforeEach(() => {
  mocks.schema.mockReset().mockResolvedValue(null)
  mocks.obs.mockReset().mockResolvedValue({ ativo: false, detalhe: {}, motivo: null })
})

describe('rodarRegistro + observador (T13)', () => {
  it('flag off: o resultado dos próprios sai intacto, sem nenhum campo obs_*', async () => {
    const { c } = contexto()
    const r = await rodarRegistro(c(mundo([]).sb))
    expect(r).toMatchObject({ estado: 'ok' })
    expect(Object.keys(r.detalhe ?? {}).filter(k => k.startsWith('obs_'))).toEqual([])
  })
  it('flag on: o detalhe ganha os contadores e o estado dos próprios continua ok', async () => {
    mocks.obs.mockResolvedValue({ ativo: true, detalhe: { obs_avaliados: 0, obs_trocas: 0 }, motivo: null })
    const { c } = contexto()
    const r = await rodarRegistro(c(mundo([]).sb))
    expect(r.estado).toBe('ok')
    expect(r.detalhe).toMatchObject({ obs_avaliados: 0, obs_trocas: 0 }) // "ok com 0 avaliados" visível
  })
  it('observador falhou: parcial com motivo observados_falhou, nunca erro', async () => {
    mocks.obs.mockResolvedValue({ ativo: true, detalhe: { obs_falhou: 2 }, motivo: 'observados_falhou' })
    const { c } = contexto()
    expect(await rodarRegistro(c(mundo([]).sb))).toMatchObject({ estado: 'parcial', motivo: 'observados_falhou' })
  })
  it('observador lançando exceção: o registrador dos próprios completa (parcial, não lança)', async () => {
    mocks.obs.mockRejectedValue(new Error('boom'))
    const { c } = contexto()
    const r = await rodarRegistro(c(mundo([]).sb))
    expect(r).toMatchObject({ estado: 'parcial', motivo: 'observados_falhou' })
  })
  it('os próprios em erro/parcial mantêm o motivo deles mesmo com o observador falhando', async () => {
    mocks.schema.mockResolvedValue({ tipo: 'ausente', texto: 'x', codigo: '42P01' })
    mocks.obs.mockResolvedValue({ ativo: true, detalhe: { obs_falhou: 1 }, motivo: 'observados_falhou' })
    const { c } = contexto()
    expect(await rodarRegistro(c(mundo([]).sb))).toMatchObject({ estado: 'parcial', motivo: 'schema_ausente' })
  })
  it('o observador roda DEPOIS dos próprios, com o teto do banco', async () => {
    const { c } = contexto()
    const ctx = c(mundo([]).sb)
    await rodarRegistro(ctx)
    expect(mocks.obs).toHaveBeenCalledWith(ctx, { fimDuroMs: ctx.t0 + 83_000 })
  })
})
