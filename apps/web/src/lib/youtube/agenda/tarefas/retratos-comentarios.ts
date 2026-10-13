import { runRetratosComentarios } from '@/lib/youtube/observatorio/comentarios/coletar'
import { codigoDe } from '@/lib/youtube/observatorio/comentarios/erro'
import { FRASES_FIXAS, fraseDe } from '@/lib/youtube/observatorio/comentarios/frases'
import { COMMENT_RULES, WORST_END_FROM_T0_MS } from '@/lib/youtube/observatorio/comentarios/regras'
import { relatarComentarios } from '@/lib/youtube/observatorio/comentarios/relato'
import { MOTIVOS_COMUNS } from '../motivos'
import type { ResultadoTarefa, Tarefa } from '../tipos'

/** As frases fixas da E14 sem os códigos que a agenda já tem (`schema_ausente`): quem está em `MOTIVOS_COMUNS` usa a frase comum. */
const MOTIVOS: Record<string, string> = Object.fromEntries(Object.entries(FRASES_FIXAS).filter(([codigo]) => !Object.hasOwn(MOTIVOS_COMUNS, codigo)))

/**
 * `retratos_comentarios`: os retratos dos comentários de destaque dos vídeos de concorrentes (24 h, 7 e 30 dias). Pesada: a vaga é da
 * agenda (cede a vez à sincronização dos canais). `comecaAteMs` e `fimAteMs` vêm de `COMMENT_RULES` e do pior caso derivado dele
 * (225 s de `t0`, que deixa os 20 s da prova e os 15 s do registro da rota).
 *
 * O adaptador devolve só CÓDIGO de catálogo e número; exceção vira `inesperado` (o código só no Sentry, nunca o texto). A guarda de
 * schema é a prova do COMEÇO (`competitor_comment_health`): ilegível, o módulo devolve `prova_ilegivel` com `na_guarda = 1` e aqui vira
 * `schema_nao_conferido` (comum da agenda). A prova do FIM da coleta segue `prova_ilegivel`. O Sentry recebe `prova_ilegivel` nos dois.
 */
export const retratosComentarios: Tarefa = {
  nome: 'retratos_comentarios',
  rotulo: 'retratos de comentários',
  ordem: 7,
  peso: 'pesada',
  periodo: 'dia',
  aPartirDaHoraSP: 13,
  tetoTentativas: 12,
  toleranciaVigiaH: 36,
  naoTerminouVermelhoEm: 6,
  comecaAteMs: COMMENT_RULES.startsByMs,
  fimAteMs: WORST_END_FROM_T0_MS,
  cedeA: ['sincronizar_canais'],
  motivos: MOTIVOS,
  fraseDe: (codigo, detalhe) => fraseDe(codigo, detalhe),
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
