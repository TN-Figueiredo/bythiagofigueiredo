// apps/web/src/lib/youtube/agenda/particoes.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { CODIGOS_SCHEMA_AUSENTE } from '@/lib/youtube/coleta/schema'
import { BANCO_MS } from './relogio'
import type { ItemAgenda } from './saude'
import type { Lido } from './tipos'

/**
 * O invariante "meses de partição à frente" (manutenção M2, spec 02 §10.2). Módulo leve: o vigia o lê sem carregar a coleta.
 * Regras, nesta ordem: leitura que falha (inclusive função ausente) → vermelho; tabela que falta, não particionada (null) ou sem o mês
 * corrente (-1) → vermelho; tarefa `particoes_a_frente` sem `ok` há mais de 72 h (sem nenhum ok: desde a conversão; sem conversão
 * registrada: vermelho; agenda não lida, `undefined`: o mesmo prazo, com o motivo "não lido") → vermelho; o pior das três abaixo de 3 → vermelho; abaixo de 6 → amarelo; senão ok. Nunca "12 à frente" sem leitura.
 */
export const AMARELO_ABAIXO_DE = 6
export const VERMELHO_ABAIXO_DE = 3
export const TAREFA_PARADA_H = 72
export const NOME_DO_ITEM = 'particoes_meses_a_frente'
const TABELAS = ['competitor_video_daily', 'competitor_video_early', 'competitor_video_hourly'] as const
const H = 3_600_000

export const MOTIVO_NAO_LIDO = 'não foi possível ler as partições à frente'
export const MOTIVO_SEM_PARTICAO = 'tabela sem partição do mês corrente ou não particionada'
export const MOTIVO_TAREFA_PARADA = 'a tarefa de partições à frente não roda há mais de 72 horas'
export const MOTIVO_POUCOS = 'menos de 3 meses de partição à frente'
export const MOTIVO_ALERTA = 'menos de 6 meses de partição à frente'

export interface LinhaParticao { tabela: string; mesesAFrente: number | null; convertidaEm: string | null }

export async function lerMesesAFrente(sb: SupabaseClient): Promise<Lido<LinhaParticao[]>> {
  try {
    const { data, error } = await sb.rpc('obs_partitions_months_ahead').abortSignal(AbortSignal.timeout(BANCO_MS))
    if (error) {
      const codigo = typeof error.code === 'string' ? error.code : ''
      return CODIGOS_SCHEMA_AUSENTE.includes(codigo)
        ? { porque: 'função de partições ausente', causa: 'schema_ausente', codigo }
        : { porque: 'erro do banco', causa: 'erro_do_banco' }
    }
    if (!Array.isArray(data)) return { porque: 'resposta fora da forma esperada', causa: 'forma_invalida' }
    const out: LinhaParticao[] = []
    for (const x of data as unknown[]) {
      if (typeof x !== 'object' || x === null) return { porque: 'resposta fora da forma esperada', causa: 'forma_invalida' }
      const o = x as Record<string, unknown>
      const m = o.months_ahead
      const conv = o.converted_at
      if (typeof o.table_name !== 'string' || !(m === null || (typeof m === 'number' && Number.isInteger(m))) || !(conv === null || typeof conv === 'string')) {
        return { porque: 'resposta fora da forma esperada', causa: 'forma_invalida' }
      }
      out.push({ tabela: o.table_name, mesesAFrente: m, convertidaEm: conv })
    }
    return { valor: out }
  } catch {
    return { porque: 'o banco não respondeu', causa: 'excecao' }
  }
}

const item = (status: ItemAgenda['status'], gravidade: 'amarelo' | 'vermelho' | undefined, motivo: string | undefined, ultimoOk: string | null | undefined): ItemAgenda => ({
  nome: NOME_DO_ITEM, status, ultimoOk: ultimoOk ?? null, toleranciaH: TAREFA_PARADA_H,
  ...(gravidade ? { gravidade } : {}), ...(motivo ? { motivo } : {}),
})

export function avaliarParticoes(lido: Lido<LinhaParticao[]>, ultimoOkTarefa: string | null | undefined, agoraMs: number): ItemAgenda {
  if ('porque' in lido) return item('late', 'vermelho', MOTIVO_NAO_LIDO, ultimoOkTarefa)
  const porTabela = new Map(lido.valor.map(l => [l.tabela, l]))
  const meses: number[] = []
  for (const t of TABELAS) {
    const l = porTabela.get(t)
    if (!l || l.mesesAFrente === null || l.mesesAFrente < 0) return item('late', 'vermelho', MOTIVO_SEM_PARTICAO, ultimoOkTarefa)
    meses.push(l.mesesAFrente)
  }
  const conversoes = lido.valor.map(l => (l.convertidaEm ? Date.parse(l.convertidaEm) : Number.NaN)).filter(n => !Number.isNaN(n))
  const okMs = ultimoOkTarefa ? Date.parse(ultimoOkTarefa) : Number.NaN
  const referencia = !Number.isNaN(okMs) ? okMs : conversoes.length ? Math.max(...conversoes) : Number.NaN
  if (Number.isNaN(referencia) || agoraMs - referencia > TAREFA_PARADA_H * H) {
    return item('late', 'vermelho', ultimoOkTarefa === undefined ? MOTIVO_NAO_LIDO : MOTIVO_TAREFA_PARADA, ultimoOkTarefa)
  }
  const pior = Math.min(...meses)
  if (pior < VERMELHO_ABAIXO_DE) return item('late', 'vermelho', MOTIVO_POUCOS, ultimoOkTarefa)
  if (pior < AMARELO_ABAIXO_DE) return item('late', 'amarelo', MOTIVO_ALERTA, ultimoOkTarefa)
  return item('ok', undefined, undefined, ultimoOkTarefa)
}
