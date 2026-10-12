// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { DIA_MS, URGENTE_DIAS, VALIDADE_DIAS, ordenarFila, perdaCobertaPorCriterios, registroDeVencimento, venceEm } from '@/lib/youtube/coleta/fila-relatorios'

// A função é pura: recebe o "agora" por parâmetro e nunca lê o relógio.
const AGORA = Date.UTC(2026, 9, 7, 12, 0, 0)
const ha = (dias: number) => new Date(AGORA - dias * DIA_MS).toISOString()
const item = (id: string, tipo: string, criadoHa: number, historico: boolean | null = false) =>
  ({ id, report_type_id: tipo, create_time: ha(criadoHa), is_backfill: historico })
const ordem = (fila: Array<ReturnType<typeof item>>) => ordenarFila(fila, AGORA).map(p => p.id)

describe('venceEm', () => {
  it('histórico vale 30 dias, corrente 60, contados do create_time', () => {
    expect(VALIDADE_DIAS).toEqual({ historico: 30, corrente: 60 })
    expect(venceEm(item('a', 'channel_basic_a3', 0, true)) - AGORA).toBe(30 * DIA_MS)
    expect(venceEm(item('b', 'channel_basic_a3', 0, false)) - AGORA).toBe(60 * DIA_MS)
  })

  it('sem a marca de histórico (nula ou ausente) vale o prazo curto: dado ausente nunca alonga o prazo', () => {
    expect(venceEm(item('a', 'channel_basic_a3', 0, null)) - AGORA).toBe(30 * DIA_MS)
    expect(venceEm({ report_type_id: 'channel_basic_a3', create_time: ha(0) }) - AGORA).toBe(30 * DIA_MS)
  })
})

describe('ordenarFila', () => {
  it('entre os que não são de alcance, quem vence primeiro vai primeiro, mesmo criado depois e de tipo de menor prioridade', () => {
    // basic de histórico criado há 10 dias vence em 20; tráfego corrente criado há 20 dias vence em 40.
    expect(ordem([item('trafego-corrente', 'channel_traffic_source_a3', 20), item('basic-historico', 'channel_basic_a3', 10, true)]))
      .toEqual(['basic-historico', 'trafego-corrente'])
  })

  it('sem nada urgente, o alcance do dia passa na frente do resto', () => {
    expect(ordem([item('basic-historico', 'channel_basic_a3', 10, true), item('alcance', 'channel_reach_basic_a1', 1)]))
      .toEqual(['alcance', 'basic-historico'])
  })

  it('o que vence em até 7 dias passa na frente de tudo, inclusive do alcance', () => {
    expect(URGENTE_DIAS).toBe(7)
    // histórico criado há 24 dias vence em 6.
    expect(ordem([item('alcance', 'channel_reach_basic_a1', 1), item('quase-vencendo', 'channel_basic_a3', 24, true)]))
      .toEqual(['quase-vencendo', 'alcance'])
  })

  it('a fronteira da urgência: exatamente 7 dias é urgente; 7 dias e 1 ms não é', () => {
    const noLimite = { id: 'no-limite', report_type_id: 'channel_basic_a3', create_time: ha(23), is_backfill: true }
    const logoDepois = { id: 'logo-depois', report_type_id: 'channel_basic_a3', create_time: new Date(AGORA - 23 * DIA_MS + 1).toISOString(), is_backfill: true }
    const alcance = item('alcance', 'channel_reach_basic_a1', 1)
    expect(ordenarFila([alcance, logoDepois, noLimite], AGORA).map(p => p.id)).toEqual(['no-limite', 'alcance', 'logo-depois'])
  })

  it('já vencido pela conta (prazo negativo) é o primeiro de todos', () => {
    expect(ordem([item('alcance', 'channel_reach_basic_a1', 1), item('urgente', 'channel_basic_a3', 25, true), item('passou', 'channel_basic_a3', 31, true)]))
      .toEqual(['passou', 'urgente', 'alcance'])
  })

  it('mesmo vencimento: a posição do tipo na lista desempata; tipo fora da lista fica por último', () => {
    expect(ordem([
      item('fora', 'channel_annotations_a1', 5, true),
      item('basic', 'channel_basic_a3', 5, true),
      item('trafego', 'channel_traffic_source_a3', 5, true),
    ])).toEqual(['trafego', 'basic', 'fora'])
  })

  it('os dois tipos de alcance com o mesmo vencimento: o básico antes do combinado, qualquer que seja a ordem de entrada', () => {
    const basico = item('basico', 'channel_reach_basic_a1', 3)
    const combinado = item('combinado', 'channel_reach_combined_a1', 3)
    expect(ordem([combinado, basico])).toEqual(['basico', 'combinado'])
    expect(ordem([basico, combinado])).toEqual(['basico', 'combinado'])
  })

  it('dois relatórios do mesmo tipo: o criado antes vai primeiro, e com o mesmo vencimento a criação mais antiga desempata', () => {
    expect(ordem([item('novo', 'channel_reach_basic_a1', 1), item('velho', 'channel_reach_basic_a1', 5)])).toEqual(['velho', 'novo'])
    // histórico criado agora e corrente criado há 30 dias vencem no mesmo instante: o mais antigo de criação vai na frente.
    expect(ordem([item('historico-novo', 'channel_basic_a3', 0, true), item('corrente-velho', 'channel_basic_a3', 30, false)]))
      .toEqual(['corrente-velho', 'historico-novo'])
  })

  it('create_time ilegível vai para a frente da fila, nunca para o fim', () => {
    const ruim = { id: 'ruim', report_type_id: 'channel_basic_a3', create_time: 'isto não é data', is_backfill: false }
    expect(ordenarFila([item('alcance', 'channel_reach_basic_a1', 1), ruim], AGORA).map(p => p.id)).toEqual(['ruim', 'alcance'])
  })

  it('não muda a lista recebida e devolve todos os itens', () => {
    const fila = [item('b', 'channel_basic_a3', 1), item('a', 'channel_basic_a3', 2)]
    const copia = [...fila]
    expect(ordenarFila(fila, AGORA)).toHaveLength(2)
    expect(fila).toEqual(copia)
    expect(ordenarFila([], AGORA)).toEqual([])
  })
})

describe('E20: registro de vencimento (MG13)', () => {
  it('linha sem o campo (anterior à MG13) é "sem registro de vencimento", nunca "não venceu"', () => {
    const linha: Record<string, unknown> = { report_type_id: 'channel_basic_a3', create_time: new Date(AGORA - 20 * DIA_MS).toISOString(), expired_at: '2026-10-01T00:00:00.000Z' }
    delete linha.expired_at
    expect(registroDeVencimento(linha)).toEqual({ tipo: 'sem_registro' })
    expect(registroDeVencimento({ expired_at: null })).toEqual({ tipo: 'sem_registro' })
    expect(registroDeVencimento({ expired_at: 'lixo' })).toEqual({ tipo: 'sem_registro' })
  })
  it('com a data da origem devolve o instante', () => {
    expect(registroDeVencimento({ expired_at: '2026-10-05T12:00:00Z' })).toEqual({ tipo: 'origem', em: '2026-10-05T12:00:00.000Z' })
  })
  it('404 em corrente criado há 20 dias passa a ser coberto pelos critérios enquanto expired_at estiver na janela', () => {
    const p = { report_type_id: 'channel_basic_a3', create_time: new Date(AGORA - 20 * DIA_MS).toISOString(), is_backfill: false }
    expect(perdaCobertaPorCriterios(p, AGORA)).toBe(false)
    expect(perdaCobertaPorCriterios({ ...p, expired_at: new Date(AGORA).toISOString() }, AGORA)).toBe(true)
    expect(perdaCobertaPorCriterios({ ...p, expired_at: new Date(AGORA - 15 * DIA_MS).toISOString() }, AGORA)).toBe(false)
  })
})
