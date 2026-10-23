// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ schema: vi.fn(), obs: vi.fn() }))
vi.mock('@/lib/youtube/competitor-health', () => ({ schemaTablesReady: mocks.schema }))
vi.mock('@/lib/youtube/teste-youtube/observados/passo', () => ({ rodarObservados: mocks.obs }))

import { rodarRegistro, OBS_FIM_MS } from '@/lib/youtube/teste-youtube/registro/tarefa'
import { BANCO_MS, LEVE_COMECA_ATE_MS } from '@/lib/youtube/agenda/relogio'
import { codigoDoMotivo, fraseDoMotivo } from '@/lib/youtube/agenda/motivos'
import { DEFINICAO_REGISTRO_TESTE_NATIVO } from '@/lib/youtube/agenda/definicoes'
import { contexto, mundo } from '../registro/mundo'

beforeEach(() => {
  mocks.schema.mockReset().mockResolvedValue(null)
  mocks.obs.mockReset().mockResolvedValue({ ativo: false, detalhe: {}, motivo: null })
})

describe('catálogo de motivos do registro (Yannis I5)', () => {
  it('observados_falhou e observados_schema_ausente têm frase própria, não "fora do catálogo"', () => {
    for (const m of ['observados_falhou', 'observados_schema_ausente']) {
      expect(codigoDoMotivo(DEFINICAO_REGISTRO_TESTE_NATIVO, m)).toBe(m)
      expect(fraseDoMotivo(DEFINICAO_REGISTRO_TESTE_NATIVO, m)).not.toMatch(/fora do catálogo/)
    }
  })
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
  it('fim do observador = min(t0 + 70 s, início + 20 s): nunca tira o tempo de avisos_pendentes (começa até 75 s) nem da pesada', async () => {
    const cedo = contexto(40_000)
    const ctxCedo = cedo.c(mundo([]).sb)
    await rodarRegistro(ctxCedo)
    expect(mocks.obs).toHaveBeenLastCalledWith(ctxCedo, { fimDuroMs: ctxCedo.t0 + 60_000 }) // início 40 s + 20 s
    const tarde = contexto(65_000)
    const ctxTarde = tarde.c(mundo([]).sb)
    await rodarRegistro(ctxTarde)
    expect(mocks.obs).toHaveBeenLastCalledWith(ctxTarde, { fimDuroMs: ctxTarde.t0 + 70_000 }) // t0 + 70 s vence
  })
  it('o teto do observador cabe antes de avisos_pendentes (LEVE_COMECA_ATE_MS) e do fimAteMs do registro, com a ida ao banco inclusa', () => {
    expect(OBS_FIM_MS).toBeLessThan(LEVE_COMECA_ATE_MS)
    expect(OBS_FIM_MS + BANCO_MS).toBeLessThan(DEFINICAO_REGISTRO_TESTE_NATIVO.fimAteMs)
  })
  it('a ordem é provada: os próprios leem o banco ANTES de o observador ser chamado', async () => {
    const { c } = contexto()
    const m = mundo([])
    let pedidosQuandoObsChamado = -1
    mocks.obs.mockImplementation(async () => { pedidosQuandoObsChamado = m.pedidos.length; return { ativo: false, detalhe: {}, motivo: null } })
    await rodarRegistro(c(m.sb))
    expect(pedidosQuandoObsChamado).toBeGreaterThan(0)
    expect(pedidosQuandoObsChamado).toBe(m.pedidos.length) // e os próprios não escrevem nem leem depois dele
  })
})
