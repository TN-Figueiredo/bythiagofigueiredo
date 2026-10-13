import { runAnularIdentidade } from '@/lib/youtube/observatorio/comentarios/anular'
import { codigoDe } from '@/lib/youtube/observatorio/comentarios/erro'
import { FRASES_FIXAS, fraseDe } from '@/lib/youtube/observatorio/comentarios/frases'
import { relatarComentarios } from '@/lib/youtube/observatorio/comentarios/relato'
import { MOTIVOS_COMUNS } from '../motivos'
import { LEVE_COMECA_ATE_MS } from '../relogio'
import type { ResultadoTarefa, Tarefa } from '../tipos'

/** O fim da tarefa, contado de `t0`: 75 s para começar mais as duas idas ao banco (apagar e ler a prova), 5 s cada. Dentro do teto das leves (90 s). */
const FIM_ATE_MS = 85_000

/** As frases fixas da E14 sem os códigos que a agenda já tem (`schema_ausente`): quem está em `MOTIVOS_COMUNS` usa a frase comum. */
const MOTIVOS: Record<string, string> = Object.fromEntries(Object.entries(FRASES_FIXAS).filter(([codigo]) => !Object.hasOwn(MOTIVOS_COMUNS, codigo)))

/**
 * `anular_identidade`: aos 28 dias a identidade do autor de um comentário (nome, id de canal, foto) é apagada. É a obrigação de LGPD
 * da E14: `nuncaDesliga` e entra na lista que roda antes do lote antigo (`antesDoLoteAntigo`, com `OBS_AGENDA=off` e com a MG10 ausente).
 * A função do banco é um `DELETE` só: idempotente e segura em duas execuções ao mesmo tempo.
 *
 * O adaptador devolve só CÓDIGO de catálogo e número. Nenhuma exceção chega ao despachante (a mensagem do Postgres poderia levar
 * nome e texto de terceiros para `competitor_agenda_runs.reason` e para o e-mail do vigia): quem lança vira `inesperado`, com o
 * código só no Sentry. Não há guarda de começo: a função ausente é o `schema_ausente` do próprio resultado, e o `prova_ilegivel` de
 * depois de apagar NÃO é trocado (o schema já respondeu: a função rodou).
 */
export const anularIdentidade: Tarefa = {
  nome: 'anular_identidade',
  rotulo: 'anular identidade de autores',
  ordem: 2,
  peso: 'leve',
  periodo: 'dia',
  aPartirDaHoraSP: 3,
  tetoTentativas: 12,
  toleranciaVigiaH: 36,
  naoTerminouVermelhoEm: null,
  comecaAteMs: LEVE_COMECA_ATE_MS,
  fimAteMs: FIM_ATE_MS,
  nuncaDesliga: true,
  motivos: MOTIVOS,
  fraseDe: (codigo, detalhe) => fraseDe(codigo, detalhe),
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
