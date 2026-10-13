import { runAnularIdentidade } from '@/lib/youtube/observatorio/comentarios/anular'
import { codigoDe } from '@/lib/youtube/observatorio/comentarios/erro'
import { relatarComentarios } from '@/lib/youtube/observatorio/comentarios/relato'
import { DEFINICAO_ANULAR_IDENTIDADE } from '../definicoes'
import type { ResultadoTarefa, Tarefa } from '../tipos'

/**
 * `anular_identidade`: aos 28 dias a identidade do autor de um comentário (nome, id de canal, foto) é apagada. É a obrigação de LGPD
 * da E14: `nuncaDesliga` e entra na lista que roda antes do lote antigo (`antesDoLoteAntigo`, com `OBS_AGENDA=off` e com a MG10 ausente).
 * A definição (rótulo, período, tolerância do vigia, tempos, frases) mora em `agenda/definicoes.ts`, o módulo leve que o vigia também lê.
 * A função do banco é um `DELETE` só: idempotente e segura em duas execuções ao mesmo tempo.
 *
 * O adaptador devolve só CÓDIGO de catálogo e número. Nenhuma exceção chega ao despachante (a mensagem do Postgres poderia levar
 * nome e texto de terceiros para `competitor_agenda_runs.reason` e para o e-mail do vigia): quem lança vira `inesperado`, com o
 * código só no Sentry. Não há guarda de começo: a função ausente é o `schema_ausente` do próprio resultado, e o `prova_ilegivel` de
 * depois de apagar NÃO é trocado (o schema já respondeu: a função rodou).
 */
export const anularIdentidade: Tarefa = {
  ...DEFINICAO_ANULAR_IDENTIDADE,
  rodar: async (c): Promise<ResultadoTarefa> => {
    try {
      const s = await runAnularIdentidade({ sb: c.sb, now: c.agora })
      return {
        estado: s.status, feitas: s.feitos, deixadas: s.ficaram,
        ...(s.motivo !== undefined ? { motivo: s.motivo } : {}),
        detalhe: s.numeros,
      }
    } catch (err) {
      relatarComentarios('anular', codigoDe(err), {})
      return { estado: 'erro', feitas: 0, deixadas: null, motivo: 'inesperado' }
    }
  },
}
