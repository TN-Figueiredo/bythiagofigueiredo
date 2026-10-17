// E5a Tarefa C4: a leitura dos comentários do canal (contagem de respostas e lista do criador), uma vez por promessa de medidas, para a célula
// e o bloco. Só lê se os vídeos do canal FORAM lidos (o carregador só lê vídeos do canal do site): canal de outro site = zero consultas.
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { lerContagemDeRespostas, lerRespostasDoCriador } from '@/lib/youtube/observatorio/comentarios/leitor-contagem'
import type { ContagemDeRespostas, ParteLida, ProvasDeQuemVe, RespostasDoCriador } from '@/lib/youtube/observatorio/comentarios/leitor-tipos'
import type { CanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FormatoDoCanal } from './cabecalho-model'
import { idsDaBaseDoCriador } from './criador-model'

export interface DoCanalParaComentarios { siteId: string; channelId: string; nome: string; provas: ProvasDeQuemVe | null
  /** A conferência da permissão falhou (guarda fora do ar): a lista cai para o número e diz por quê. */
  permissaoFalhou?: boolean }
export interface ComentariosDoCanal { contagem: ParteLida<ContagemDeRespostas> | null; respostas: ParteLida<RespostasDoCriador> | null }

const porPromessa = new WeakMap<Promise<CanalInteiro>, Promise<ComentariosDoCanal>>()

export function lerComentariosDoCanal(
  medidas: Promise<CanalInteiro>, c: CanalInteiro, k: DoCanalParaComentarios, base: { formato: FormatoDoCanal; agoraMs: number }, cliente: () => SupabaseClient = () => getSupabaseServiceClient(),
): Promise<ComentariosDoCanal> {
  const feito = porPromessa.get(medidas)
  if (feito) return feito
  const p = (async (): Promise<ComentariosDoCanal> => {
    if (!c.videos.lido) return { contagem: null, respostas: null }
    // I1 (portão da C4): lê só a BASE da conta (formato, até 90 dias), e a lista só os vídeos das casas com resposta vista. Uma consulta de cada.
    const videoIds = idsDaBaseDoCriador(c.videos.dados, base.formato.fmt, base.agoraMs)
    try {
      const sb = cliente()
      const contagem = await lerContagemDeRespostas(sb, { siteId: k.siteId, channelId: k.channelId, videoIds })
      if (!contagem.lido) return { contagem, respostas: null }
      const comResposta = videoIds.filter(id => {
        const x = contagem.dados.porVideo.get(id)
        return x !== undefined && x.retrato30 === 'ok' && x.algumComRespostaDoCriador
      })
      const respostas = await lerRespostasDoCriador(sb, { siteDaGuarda: k.siteId, provas: k.provas, channelId: k.channelId, videoIds: comResposta })
      return { contagem, respostas }
    } catch (e) {
      // sem texto e sem id de comentário (regra do plano): só o site e o nome do erro
      Sentry.captureMessage('observatório: leitura dos comentários do canal falhou', { level: 'warning', extra: { siteId: k.siteId, causa: e instanceof Error ? e.name : 'desconhecida' } })
      return { contagem: null, respostas: null }
    }
  })()
  porPromessa.set(medidas, p)
  return p
}
