import { recordQuota } from '@/lib/youtube/competitor-quota'
import { schemaGroups, schemaTablesReady } from '@/lib/youtube/competitor-health'
import { runWeeklyPhase, weeklyPendingCount } from '@/lib/youtube/competitor-sync-batch'
import { BANCO_MS } from '../relogio'
import type { ResultadoTarefa, Tarefa } from '../tipos'

/**
 * `serie_semanal`: a fase semanal do lote, agora uma tarefa própria (a partir das 12:00 de São Paulo, depois da sincronização dos canais).
 * O primeiro erro da fase (canal e motivo, texto de fora) vai só em `extra`, para a resposta do cron; nunca para `motivo` nem `detalhe`.
 */
export const serieSemanal: Pick<Tarefa, 'rodar' | 'devidaPeloDado'> = {
  rodar: async (c): Promise<ResultadoTarefa> => {
    const guarda = await schemaTablesReady(c.sb, schemaGroups('e1e2'), { signal: AbortSignal.timeout(BANCO_MS) })
    if (guarda) return { estado: 'erro', feitas: 0, deixadas: null, motivo: guarda.tipo === 'ausente' ? 'schema_ausente' : 'schema_nao_conferido' }
    if (!c.linhas) return { estado: 'erro', feitas: 0, deixadas: null, motivo: 'canais_nao_lidos' }
    const w = await runWeeklyPhase(c.linhas, { apiKey: c.apiKey, started: c.t0, now: c.agora })
    // o número de erros da fase fica na linha da cota do dia do site, que é durável; a resposta do cron ninguém guarda
    for (const [siteId, n] of Object.entries(w.errorsBySite)) {
      await recordQuota(c.sb, { siteId, nowMs: c.agora(), units: 0, mode: 'competitors_semanal', extra: { erros_semanal: n } }).catch(() => undefined)
    }
    const detalhe = { visitados: w.visited, completos: w.complete, pendentes: w.pending, gravados: w.recorded, adiados: w.deferred, erros: w.errors }
    if (w.errors > 0 && w.recorded === 0) return { estado: 'erro', feitas: 0, deixadas: null, motivo: 'semanal_erro', detalhe, extra: w }
    if (w.errors > 0) return { estado: 'parcial', feitas: w.recorded, deixadas: w.deferred, motivo: 'semanal_com_erros', detalhe, extra: w }
    if (w.deferred > 0) return { estado: 'parcial', feitas: w.recorded, deixadas: w.deferred, motivo: 'sobrou', detalhe, extra: w }
    return { estado: 'ok', feitas: w.recorded, deixadas: 0, detalhe, extra: w }
  },
  devidaPeloDado: ({ linhas, agora }) => linhas !== null && weeklyPendingCount(linhas, agora()) > 0,
}
