import { schemaGroups, schemaTablesReady } from '@/lib/youtube/competitor-health'
import { BATCH_BUDGET_MS, batchHealth, firstSyncPending, isDue, runCompetitorBatch } from '@/lib/youtube/competitor-sync-batch'
import { BANCO_MS } from '../relogio'
import type { ResultadoTarefa, Tarefa } from '../tipos'

/** O tamanho do lote de canais por disparo (o spike S2: 15 canais, cron a cada 20 minutos). */
const BATCH_SIZE = 15

/**
 * `sincronizar_canais`: o lote de canais que o cron fazia sozinho, agora uma tarefa da agenda (sem a fase semanal, que é a
 * `serie_semanal`). A corrida contra o tempo é a do despachante (`fimAteMs`), o mesmo corte que a rota tinha. O resumo do lote vai inteiro
 * em `extra` (a resposta do cron o repete como hoje); a frase de `batchHealth` vai para a mensagem do cron pelo fecho, e não para `motivo`.
 */
export const sincronizarCanais: Pick<Tarefa, 'rodar' | 'devidaPeloDado'> = {
  rodar: async (c): Promise<ResultadoTarefa> => {
    const guarda = await schemaTablesReady(c.sb, schemaGroups('e1e2'), { signal: AbortSignal.timeout(BANCO_MS) })
    if (guarda) return { estado: 'erro', feitas: 0, deixadas: null, motivo: guarda.tipo === 'ausente' ? 'schema_ausente' : 'schema_nao_conferido' }
    const r = await runCompetitorBatch({ apiKey: c.apiKey, batchSize: BATCH_SIZE, budgetMs: BATCH_BUDGET_MS, weekly: false, started: c.t0 })
    const detalhe = { sincronizados: r.synced, erros: r.errors, pulados: r.skipped, devidos_sobrando: r.remainingDue }
    if (!batchHealth(r).ok) return { estado: 'erro', feitas: r.synced, deixadas: null, motivo: 'lote_em_erro', detalhe, extra: r }
    if (r.remainingDue > 0 || r.stoppedForTime || r.skipped > 0) {
      return { estado: 'parcial', feitas: r.synced, deixadas: r.remainingDue + r.skipped, motivo: 'sobrou', detalhe, extra: r }
    }
    return { estado: 'ok', feitas: r.synced, deixadas: 0, detalhe, extra: r }
  },
  // A mesma regra do lote (`competitor-sync-batch.ts`): canal devido pela faixa, ou com a primeira sincronização ainda pendente.
  devidaPeloDado: ({ linhas, agora }) => linhas !== null && linhas.some(l => isDue(l.last_synced_at, agora()) || firstSyncPending(l)),
}
