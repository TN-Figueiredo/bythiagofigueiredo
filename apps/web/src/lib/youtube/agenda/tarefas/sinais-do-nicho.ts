import * as Sentry from '@sentry/nextjs'
import { rodarSinaisDoNicho } from '@/lib/youtube/observatorio/sinais/gravador'
import { DEFINICAO_SINAIS_DO_NICHO } from '../definicoes'
import { PESADA_FIM_MS } from '../relogio'
import type { ResultadoTarefa, Tarefa } from '../tipos'

/**
 * `sinais_do_nicho` (F2 T7): delega a `rodarSinaisDoNicho` e devolve só CÓDIGO de catálogo e número. O prazo é o que resta até `PESADA_FIM_MS`
 * no momento em que a tarefa começa (nunca constante). Exceção vira `inesperado`; só a classe e o SQLSTATE vão ao Sentry.
 */
export const sinaisDoNicho: Tarefa = {
  ...DEFINICAO_SINAIS_DO_NICHO,
  rodar: async (c): Promise<ResultadoTarefa> => {
    try {
      const inicioMs = c.agora() - c.t0
      const r = await rodarSinaisDoNicho({ sb: c.sb, agora: new Date(c.agora()), prazoMs: PESADA_FIM_MS - inicioMs, inicioMs })
      return {
        estado: r.motivo === undefined ? 'ok' : 'erro',
        feitas: r.novos + r.atualizados, deixadas: r.falhas,
        ...(r.motivo !== undefined ? { motivo: r.motivo } : {}),
        detalhe: {
          inicio_ms: r.inicioMs, sites: r.sites, novos: r.novos, atualizados: r.atualizados, expirados: r.expirados, falhas: r.falhas, ms: r.ms,
          outliers: r.outliers, outliers_sem_lugar: r.outliersSemLugar, outliers_descartados: r.outliersDescartados, lugares_regravados: r.lugaresRegravados,
        },
      }
    } catch (err) {
      const codigo = typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string' ? ' ' + err.code.slice(0, 5) : ''
      Sentry.captureMessage('sinais_do_nicho: inesperado: ' + (err instanceof Error ? err.name : typeof err) + codigo, 'error')
      return { estado: 'erro', feitas: 0, deixadas: null, motivo: 'inesperado' }
    }
  },
}
