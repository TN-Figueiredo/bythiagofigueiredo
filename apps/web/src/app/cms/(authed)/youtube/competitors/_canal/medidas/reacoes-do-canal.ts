// T13: da leitura das medidas do canal para os sinalizadores que a Lista usa nas células de curtidas e comentários.
// Devolve SÓ as exceções (curtidas ocultas, ou 0 com sinalizador lido como "não oculto"); id ausente = metade sem sinalizador.
import type { CanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'
import type { Reacoes } from '../tabela'

/** `null` quando os vídeos não foram lidos ou algo falhou (nunca lança). O id é `ChannelVideoView.id` (= `VideoLido.id`, não o ytId). */
export function reacoesDoCanal(c: CanalInteiro, videos: ReadonlyArray<{ id: string; likes: number | null; comments: number | null }>): Reacoes | null {
  try {
    if (!c.videos.lido) return null
    const porId = new Map(videos.map(v => [v.id, v] as const))   // uma passada, sem `find` por vídeo
    const out: Reacoes = {}
    for (const l of c.videos.dados) {
      const v = porId.get(l.id)
      if (!v) continue
      const curtida = l.likesHidden === true || (l.likesHidden === false && v.likes === 0)
      const comentario = l.commentsDisabled === true || (l.commentsDisabled === false && v.comments === 0)
      if (curtida || comentario) out[l.id] = { likesHidden: l.likesHidden, commentsDisabled: l.commentsDisabled }
    }
    return out
  } catch {
    return null
  }
}

/** A promessa que a página entrega à tela: nunca rejeita (falha das medidas vira `null` = metade sem sinalizador). */
export function reacoesDaPromessa(medidas: Promise<CanalInteiro>, videos: ReadonlyArray<{ id: string; likes: number | null; comments: number | null }>): Promise<Reacoes | null> {
  return medidas.then(c => reacoesDoCanal(c, videos), () => null)
}
