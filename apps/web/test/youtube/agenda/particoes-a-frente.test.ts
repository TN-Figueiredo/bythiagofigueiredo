// apps/web/test/youtube/agenda/particoes-a-frente.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { particoesAFrente, mesAlvo, MESES_A_FRENTE_ALVO } from '@/lib/youtube/agenda/tarefas/particoes-a-frente'
import { CATALOGO } from '@/lib/youtube/agenda/catalogo'
import { TODAS_AS_DEFINICOES } from '@/lib/youtube/agenda/definicoes'
import { antesDoLoteAntigo } from '@/lib/youtube/agenda/executar'
import type { ContextoTarefa } from '@/lib/youtube/agenda/tipos'

const AGORA = Date.parse('2026-10-24T15:00:00Z')
// Relativas ao AGORA injetado (mês de SP + 12 / + 11), sem literal de ano futuro (regra anti-regressão de fixtures temporais).
const mesMais = (n: number) => { const d = new Date(AGORA); d.setUTCMonth(d.getUTCMonth() + n, 1); return d.toISOString().slice(0, 10) }
const ALVO = mesMais(12)
const ALVO_MENOS_1 = mesMais(11)
type Resp = { data: unknown; error: { code: string; message: string } | null }
function ctx(resp: Resp | 'lanca'): { c: ContextoTarefa; chamadas: Array<{ fn: string; args: unknown }> } {
  const chamadas: Array<{ fn: string; args: unknown }> = []
  const sb = {
    rpc: (fn: string, args: unknown) => {
      chamadas.push({ fn, args })
      return { abortSignal: () => (resp === 'lanca' ? Promise.reject(new Error('rede')) : Promise.resolve(resp)) }
    },
  } as unknown as SupabaseClient
  return { c: { t0: 0, agora: () => AGORA, apiKey: '', sb, linhas: null }, chamadas }
}
const TRES = [
  { table_name: 'competitor_video_daily', last_month: ALVO, created: 0 },
  { table_name: 'competitor_video_early', last_month: ALVO, created: 1 },
  { table_name: 'competitor_video_hourly', last_month: ALVO, created: 0 },
]

describe('particoes_a_frente no catálogo (item 10: falha se a tarefa que chama ensure não existir)', () => {
  it('existe no catálogo, na lista do vigia e em antesDoLoteAntigo, nuncaDesliga, devida a partir das 06:00 de SP', () => {
    expect(CATALOGO.map(t => t.nome)).toContain('particoes_a_frente')
    expect(TODAS_AS_DEFINICOES.map(d => d.nome)).toContain('particoes_a_frente')
    expect(antesDoLoteAntigo.map(t => t.nome)).toContain('particoes_a_frente')
    expect(TODAS_AS_DEFINICOES.find(d => d.nome === 'particoes_a_frente')).toMatchObject({
      peso: 'leve', periodo: 'dia', aPartirDaHoraSP: 6, nuncaDesliga: true, tetoTentativas: 12,
    })
  })
})

describe('particoes_a_frente: o que roda', () => {
  it('chama obs_partitions_ensure com 12 meses e termina ok com as criadas', async () => {
    const { c, chamadas } = ctx({ data: TRES, error: null })
    const r = await particoesAFrente.rodar(c)
    expect(chamadas).toEqual([{ fn: 'obs_partitions_ensure', args: { p_months_ahead: MESES_A_FRENTE_ALVO } }])
    expect(r).toEqual({ estado: 'ok', feitas: 1, deixadas: 0, detalhe: { criadas: 1 } })
  })
  it('função ausente (migration não aplicada): erro funcao_ausente, nunca ok', async () => {
    for (const code of ['PGRST202', '42883']) {
      const r = await particoesAFrente.rodar(ctx({ data: null, error: { code, message: 'x' } }).c)
      expect(r).toMatchObject({ estado: 'erro', motivo: 'funcao_ausente' })
    }
  })
  it('tabela ainda não particionada ou outro erro do banco: erro banco_recusou', async () => {
    const r = await particoesAFrente.rodar(ctx({ data: null, error: { code: 'P0001', message: 'M2:tabela_nao_particionada: competitor_video_early' } }).c)
    expect(r).toMatchObject({ estado: 'erro', motivo: 'banco_recusou' })
  })
  it('resposta vazia, fora da forma ou sem uma das três: erro resposta_invalida', async () => {
    for (const data of [null, [], [TRES[0], TRES[1]], [{ ...TRES[0], last_month: null }, TRES[1], TRES[2]], 'x']) {
      const r = await particoesAFrente.rodar(ctx({ data, error: null }).c)
      expect(r, JSON.stringify(data)).toMatchObject({ estado: 'erro', motivo: 'resposta_invalida' })
    }
  })
  it('exceção (rede): erro inesperado, sem texto de fora', async () => {
    const r = await particoesAFrente.rodar(ctx('lanca').c)
    expect(r).toEqual({ estado: 'erro', feitas: 0, deixadas: null, motivo: 'inesperado' })
  })
  it('prazo estourado (AbortSignal.timeout volta como error, não lança): erro prazo, nunca banco_recusou', async () => {
    for (const message of ['AbortError: This operation was aborted', 'TimeoutError: The operation was aborted due to timeout']) {
      const r = await particoesAFrente.rodar(ctx({ data: null, error: { code: '', message } }).c)
      expect(r, message).toEqual({ estado: 'erro', feitas: 0, deixadas: null, motivo: 'prazo' })
    }
  })
  it('falha de rede (o supabase-js devolve error com code vazio): sem_resposta, nunca banco_recusou', async () => {
    const r = await particoesAFrente.rodar(ctx({ data: null, error: { code: '', message: 'TypeError: fetch failed' } }).c)
    expect(r).toEqual({ estado: 'erro', feitas: 0, deixadas: null, motivo: 'sem_resposta' })
  })
  it('erro do Postgres cuja mensagem contém "aborted" (25P02): banco_recusou, não prazo', async () => {
    const r = await particoesAFrente.rodar(ctx({ data: null, error: { code: '25P02', message: 'current transaction is aborted' } }).c)
    expect(r).toMatchObject({ estado: 'erro', motivo: 'banco_recusou' })
  })
  it('M1: last_month aquém do alvo (mês corrente de SP + 12) em qualquer das três: erro aquem_do_alvo, nunca ok', async () => {
    expect(mesAlvo(AGORA)).toBe(ALVO.slice(0, 7))
    expect(mesAlvo(Date.parse('2026-12-01T01:00:00Z'))).toBe('2027-11') // 30/11 22:00 em SP
    const curta = TRES.map((l, i) => (i === 2 ? { ...l, last_month: ALVO_MENOS_1 } : l))
    const r = await particoesAFrente.rodar(ctx({ data: curta, error: null }).c)
    expect(r).toEqual({ estado: 'erro', feitas: 0, deixadas: null, motivo: 'aquem_do_alvo' })
  })
})
