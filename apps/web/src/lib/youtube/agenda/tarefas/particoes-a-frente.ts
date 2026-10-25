// apps/web/src/lib/youtube/agenda/tarefas/particoes-a-frente.ts
import * as Sentry from '@sentry/nextjs'
import { CODIGOS_SCHEMA_AUSENTE } from '@/lib/youtube/coleta/schema'
import { DEFINICAO_PARTICOES_A_FRENTE } from '../definicoes'
import { BANCO_MS } from '../relogio'
import type { ResultadoTarefa, Tarefa } from '../tipos'

/** Quantos meses à frente a tarefa garante (o mesmo número da conversão). */
export const MESES_A_FRENTE_ALVO = 12
const TABELAS = ['competitor_video_daily', 'competitor_video_early', 'competitor_video_hourly'] as const

interface LinhaEnsure { table_name: string; last_month: string; created: number }

/** O mês-alvo ('AAAA-MM'): o mês corrente em São Paulo + 12. */
export function mesAlvo(agoraMs: number): string {
  const [a, m] = new Date(agoraMs).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).split('-').map(Number) as [number, number]
  const idx = a * 12 + (m - 1) + MESES_A_FRENTE_ALVO
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`
}

function ler(data: unknown): LinhaEnsure[] | null {
  if (!Array.isArray(data)) return null
  const linhas: LinhaEnsure[] = []
  for (const x of data) {
    if (typeof x !== 'object' || x === null) return null
    const o = x as Record<string, unknown>
    if (typeof o.table_name !== 'string' || typeof o.last_month !== 'string' || typeof o.created !== 'number' || !Number.isInteger(o.created)) return null
    linhas.push({ table_name: o.table_name, last_month: o.last_month, created: o.created })
  }
  const nomes = new Set(linhas.map(l => l.table_name))
  return TABELAS.every(t => nomes.has(t)) && linhas.length === TABELAS.length ? linhas : null
}

/**
 * Chama `obs_partitions_ensure(12)`. Nenhuma exceção chega ao despachante e nenhum texto do banco sai daqui (só código de catálogo).
 * Sem dado (resposta vazia, sem uma das três, `last_month` nulo): `resposta_invalida`, nunca `ok`.
 */
export const particoesAFrente: Tarefa = {
  ...DEFINICAO_PARTICOES_A_FRENTE,
  rodar: async (c): Promise<ResultadoTarefa> => {
    try {
      const { data, error } = await c.sb.rpc('obs_partitions_ensure', { p_months_ahead: MESES_A_FRENTE_ALVO }).abortSignal(AbortSignal.timeout(BANCO_MS))
      if (error) {
        const codigo = typeof error.code === 'string' ? error.code : ''
        // o supabase-js devolve a falha de fetch/timeout como `error` com code '' (não lança); só ela é prazo ou rede, nunca um erro com código do Postgres (25P02 "aborted")
        if (codigo === '') {
          const msg = String(error.message ?? '')
          return { estado: 'erro', feitas: 0, deixadas: null, motivo: /^(AbortError|TimeoutError):/.test(msg) ? 'prazo' : 'sem_resposta' }
        }
        return { estado: 'erro', feitas: 0, deixadas: null, motivo: CODIGOS_SCHEMA_AUSENTE.includes(codigo) ? 'funcao_ausente' : 'banco_recusou' }
      }
      const linhas = ler(data)
      if (!linhas) return { estado: 'erro', feitas: 0, deixadas: null, motivo: 'resposta_invalida' }
      const alvo = mesAlvo(c.agora())
      if (linhas.some(l => l.last_month.slice(0, 7) < alvo)) return { estado: 'erro', feitas: 0, deixadas: null, motivo: 'aquem_do_alvo' }
      const criadas = linhas.reduce((s, l) => s + l.created, 0)
      return { estado: 'ok', feitas: criadas, deixadas: 0, detalhe: { criadas } }
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'agenda', tarefa: 'particoes_a_frente' } })
      return { estado: 'erro', feitas: 0, deixadas: null, motivo: 'inesperado' }
    }
  },
}
