import { runRetratosComentarios } from '@/lib/youtube/observatorio/comentarios/coletar'
import { codigoDe } from '@/lib/youtube/observatorio/comentarios/erro'
import { relatarComentarios } from '@/lib/youtube/observatorio/comentarios/relato'
import { DEFINICAO_RETRATOS_COMENTARIOS } from '../definicoes'
import type { ResultadoTarefa, Tarefa } from '../tipos'

/**
 * `retratos_comentarios`: os retratos dos comentários de destaque dos vídeos de concorrentes (24 h, 7 e 30 dias). Pesada: a vaga é da
 * agenda (cede a vez à sincronização dos canais). A definição (tempos, tolerância do vigia, frases) mora em `agenda/definicoes.ts`, o módulo
 * leve que o vigia também lê.
 *
 * O adaptador devolve só CÓDIGO de catálogo e número; exceção vira `inesperado` (o código só no Sentry, nunca o texto). A guarda de
 * schema é a prova do COMEÇO (`competitor_comment_health`): ilegível, o módulo devolve `prova_ilegivel` com `na_guarda = 1` e aqui vira
 * `schema_nao_conferido` (comum da agenda). A prova do FIM da coleta segue `prova_ilegivel`. O Sentry recebe `prova_ilegivel` nos dois.
 */
export const retratosComentarios: Tarefa = {
  ...DEFINICAO_RETRATOS_COMENTARIOS,
  rodar: async (c): Promise<ResultadoTarefa> => {
    try {
      const s = await runRetratosComentarios({ sb: c.sb, apiKey: c.apiKey, now: c.agora, t0: c.t0, inicioMs: c.agora() })
      // Nada mais relata a prova ilegível da coleta (o módulo só devolve o código): o Sentry a recebe daqui, sempre como `prova_ilegivel`.
      if (s.motivo === 'prova_ilegivel') relatarComentarios('coletar', 'prova_ilegivel', {})
      const naGuarda = s.motivo === 'prova_ilegivel' && s.numeros.na_guarda === 1
      const motivo = naGuarda ? 'schema_nao_conferido' : s.motivo
      return {
        estado: s.status, feitas: s.feitos, deixadas: s.ficaram,
        ...(motivo !== undefined ? { motivo } : {}),
        detalhe: s.numeros,
      }
    } catch (err) {
      relatarComentarios('coletar', codigoDe(err), {})
      return { estado: 'erro', feitas: 0, deixadas: null, motivo: 'inesperado' }
    }
  },
}
