// E5a Tarefa C4: a leitura dos comentários do canal (contagem de respostas e lista do criador), uma vez por promessa de medidas, para a célula
// e o bloco. Só lê se os vídeos do canal FORAM lidos (o carregador só lê vídeos do canal do site): canal de outro site = zero consultas.
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { lerContagemDeRespostas, lerRespostasDoCriador } from '@/lib/youtube/observatorio/comentarios/leitor-contagem'
import type { ContagemDeRespostas, ParteLida, ProvasDeQuemVe, RespostasDoCriador } from '@/lib/youtube/observatorio/comentarios/leitor-tipos'
import type { CanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface DoCanalParaComentarios { siteId: string; channelId: string; nome: string; provas: ProvasDeQuemVe | null }
export interface ComentariosDoCanal { contagem: ParteLida<ContagemDeRespostas> | null; respostas: ParteLida<RespostasDoCriador> | null }

const porPromessa = new WeakMap<Promise<CanalInteiro>, Promise<ComentariosDoCanal>>()

export function lerComentariosDoCanal(
  medidas: Promise<CanalInteiro>, c: CanalInteiro, k: DoCanalParaComentarios, cliente: () => SupabaseClient = () => getSupabaseServiceClient(),
): Promise<ComentariosDoCanal> {
  const feito = porPromessa.get(medidas)
  if (feito) return feito
  const p = (async (): Promise<ComentariosDoCanal> => {
    if (!c.videos.lido) return { contagem: null, respostas: null }
    const videoIds = c.videos.dados.map(v => v.id)
    try {
      const sb = cliente()
      const contagem = await lerContagemDeRespostas(sb, { siteId: k.siteId, channelId: k.channelId, videoIds })
      const respostas = await lerRespostasDoCriador(sb, { siteDaGuarda: k.siteId, provas: k.provas, channelId: k.channelId, videoIds })
      return { contagem, respostas }
    } catch {
      return { contagem: null, respostas: null }
    }
  })()
  porPromessa.set(medidas, p)
  return p
}
