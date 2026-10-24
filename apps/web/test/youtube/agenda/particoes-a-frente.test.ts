// apps/web/test/youtube/agenda/particoes-a-frente.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { particoesAFrente, MESES_A_FRENTE_ALVO } from '@/lib/youtube/agenda/tarefas/particoes-a-frente'
import { CATALOGO } from '@/lib/youtube/agenda/catalogo'
import { TODAS_AS_DEFINICOES } from '@/lib/youtube/agenda/definicoes'
import { antesDoLoteAntigo } from '@/lib/youtube/agenda/executar'
import type { ContextoTarefa } from '@/lib/youtube/agenda/tipos'

type Resp = { data: unknown; error: { code: string; message: string } | null }
function ctx(resp: Resp | 'lanca'): { c: ContextoTarefa; chamadas: Array<{ fn: string; args: unknown }> } {
  const chamadas: Array<{ fn: string; args: unknown }> = []
  const sb = {
    rpc: (fn: string, args: unknown) => {
      chamadas.push({ fn, args })
      return { abortSignal: () => (resp === 'lanca' ? Promise.reject(new Error('rede')) : Promise.resolve(resp)) }
    },
  } as unknown as SupabaseClient
  return { c: { t0: 0, agora: () => 0, apiKey: '', sb, linhas: null }, chamadas }
}
const TRES = [
  { table_name: 'competitor_video_daily', last_month: '2027-10-01', created: 0 },
  { table_name: 'competitor_video_early', last_month: '2027-10-01', created: 1 },
  { table_name: 'competitor_video_hourly', last_month: '2027-10-01', created: 0 },
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
    const r = await particoesAFrente.rodar(ctx({ data: null, error: { code: '', message: 'AbortError: This operation was aborted' } }).c)
    expect(r).toEqual({ estado: 'erro', feitas: 0, deixadas: null, motivo: 'prazo' })
  })
})
