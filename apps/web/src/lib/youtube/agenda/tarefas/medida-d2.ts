import * as Sentry from '@sentry/nextjs'
import { codigoDoErro, ehSchemaAusente, medirD2 } from '@/lib/youtube/observatorio/sinais/medida/passo'
import { DEFINICAO_MEDIDA_D2 } from '../definicoes'
import type { ResultadoTarefa, Tarefa } from '../tipos'

/**
 * `medida_d2` (F2b T4): delega a `medirD2` e devolve só CÓDIGO de catálogo e número. O prazo é `fimAteMs` menos o que já correu desde `t0`
 * (nunca constante). Não chama a F2 (`rodarSinaisDoNicho`). Exceção: só a classe e o SQLSTATE vão ao Sentry; tabela ausente = `schema_ausente`.
 */
export const medidaD2: Tarefa = {
  ...DEFINICAO_MEDIDA_D2,
  rodar: async (c): Promise<ResultadoTarefa> => {
    try {
      const r = await medirD2({ sb: c.sb, t0: c.t0, agora: c.agora, fimMs: DEFINICAO_MEDIDA_D2.fimAteMs })
      return {
        estado: r.motivo === undefined ? 'ok' : 'erro',
        feitas: r.feitas, deixadas: r.deixadas,
        ...(r.motivo !== undefined ? { motivo: r.motivo } : {}),
        detalhe: { ...r.detalhe },
      }
    } catch (err) {
      const codigo = codigoDoErro(err)
      Sentry.captureMessage('medida_d2: ' + (err instanceof Error ? err.name : typeof err) + (codigo ? ' ' + codigo : ''), 'error')
      return { estado: 'erro', feitas: 0, deixadas: null, motivo: ehSchemaAusente(err) ? 'schema_ausente' : 'medida_falhou' }
    }
  },
}
