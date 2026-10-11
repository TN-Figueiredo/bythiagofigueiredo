// Monta o ViewerInput de um vídeo a partir das versões de thumbnail do motor (ObsVideo). Puro: sem DOM.
// A legenda, o período e o tempo no ar de cada versão são os do Histórico do vídeo: a mesma conta (`../version-span.ts`), com a precisão
// (publicação, minuto, janela, "vista desde"), o canal parado e o "pelo menos". Duas contas dariam duas legendas para o mesmo vídeo.
import type { Observatory } from '@/lib/youtube/observatorio'
import type { ObsChannel, ObsVideo } from '@/lib/youtube/observatorio/types'
import { imageLetters, thumbCaption, versionClock } from '../version-span'
import { isYoutubeUrl, type ViewerInput, type ViewerVersion } from './viewer-model'

export { imageLetters }

/**
 * O visualizador de um vídeo que só se conhece pela tela: a thumbnail atual e mais nada (o vídeo antigo, na forma enxuta, que não carrega versões
 * no pacote da página: 3.000 deles somam megabytes). O que a tela já mostra (`thumbSrc`) vai como preview; se for do Blob, vale também como cópia.
 */
export function viewerSoAtual(v: { title: string; ytId: string; thumbSrc: string | null }): ViewerInput | null {
  if (!v.ytId && !v.thumbSrc) return null
  const archived = v.thumbSrc && !isYoutubeUrl(v.thumbSrc) ? v.thumbSrc : null
  const one: ViewerVersion = { label: 'Capa atual', current: true, archived, youtubeId: v.ytId || null, caption: 'Capa atual (no ar): a thumbnail que o YouTube mostra agora', from: '', to: 'agora', preview: v.thumbSrc }
  return { title: v.title, versions: [one], start: 0 }
}

/**
 * Uma versão por período de thumbnail; a atual é a que o motor marca. Sem versão nenhuma (vídeo antigo, forma enxuta) vira uma só, a atual,
 * com a imagem do YouTube; sem versão e sem id do YouTube não há o que mostrar (null). `preview` é a imagem que a tela já exibe.
 */
export function viewerOfVideo(obs: Observatory, v: ObsVideo, ch: ObsChannel, title: string, preview: string | null): ViewerInput | null {
  const ytId = v.ytId || null
  if (!v.thumbs.length) {
    if (!ytId) return null
    const one: ViewerVersion = { label: 'Capa atual', current: true, archived: null, youtubeId: ytId, caption: 'Capa atual (no ar): a thumbnail que o YouTube mostra agora', from: '', to: 'agora', preview }
    return { title, versions: [one], start: 0 }
  }
  const clock = versionClock(obs, v, ch)
  const letter = imageLetters(v.thumbs)
  const versions = v.thumbs.map((t, i): ViewerVersion => {
    const label = letter.get(t.key) ?? t.key, cur = !v.thumbs[i + 1]   // a atual é a última, como no Histórico
    const { startLbl, end, span, durTxt } = clock.timing('thumb', v.thumbs, i)
    return {
      label: 'Capa ' + label, current: cur, archived: t.blobUrl ?? null, youtubeId: cur ? ytId : null,
      caption: thumbCaption(label, cur, clock.curWord('thumb'), span, durTxt),
      from: startLbl, to: end, span, preview: t.blobUrl ?? (cur ? preview : null),
    }
  })
  return { title, versions, start: versions.length - 1 }
}
