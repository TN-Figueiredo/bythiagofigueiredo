import * as Sentry from '@sentry/nextjs'
import { runFecharMarcas } from '@/lib/youtube/observatorio/medidas/fechar-marcas'
import { DEFINICAO_MARCAS_DE_IDADE } from '../definicoes'
import type { ResultadoTarefa, Tarefa } from '../tipos'

/**
 * `marcas_de_idade` (A5 E4, Tarefa 11): delega a `runFecharMarcas` e devolve só CÓDIGO de catálogo e número. Nenhuma exceção chega ao despachante
 * (a mensagem do Postgres iria para `competitor_agenda_runs.reason`): quem lança vira `inesperado`, e só a classe do erro e o SQLSTATE vão ao Sentry.
 * Sem guarda de começo: a função ausente é o `schema_ausente` do próprio resultado. Sem `devidaPeloDado` e sem `nuncaDesliga`.
 * A definição (rótulo, período, tolerância do vigia, tempos, frases) mora em `agenda/definicoes.ts`, o módulo leve que o vigia também lê.
 */
export const marcasDeIdade: Tarefa = {
  ...DEFINICAO_MARCAS_DE_IDADE,
  rodar: async (c): Promise<ResultadoTarefa> => {
    try {
      const s = await runFecharMarcas({ sb: c.sb, now: c.agora })
      return {
        estado: s.status, feitas: s.feitos, deixadas: s.ficaram,
        ...(s.motivo !== undefined ? { motivo: s.motivo } : {}),
        detalhe: s.numeros,
      }
    } catch (err) {
      const codigo = typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string' ? ' ' + err.code.slice(0, 5) : ''
      Sentry.captureMessage('marcas_de_idade: inesperado: ' + (err instanceof Error ? err.name : typeof err) + codigo, 'error')
      return { estado: 'erro', feitas: 0, deixadas: null, motivo: 'inesperado' }
    }
  },
}
