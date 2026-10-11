// Monta o ViewerInput de um vídeo a partir das versões de thumbnail do motor (ObsVideo). Puro: sem DOM, sem motor inteiro.
// É a forma enxuta, a da página do canal: o rótulo (a letra da imagem), o período e o tempo no ar saem só de `first_seen`.
// O Histórico do vídeo tem a sua própria conta (precisão, janelas, "última vista"), que vive no view-model dele.
import type { ThumbVersion } from '@/lib/youtube/observatorio/types'
import { isYoutubeUrl, type ViewerInput, type ViewerVersion } from './viewer-model'

export interface ViewerClock { dmhm(ms: number): string; dur(ms: number): string }

/** A letra de cada imagem, na ordem em que aparece pela primeira vez: A, B, … (a mesma conta do Histórico; depois de Z, Z1, Z2…). */
export function imageLetters(thumbs: readonly Pick<ThumbVersion, 'key'>[]): Map<string, string> {
  const keys = new Map<string, string>()
  for (const t of thumbs) if (!keys.has(t.key)) { const k = keys.size; keys.set(t.key, k < 26 ? String.fromCharCode(65 + k) : 'Z' + (k - 25)) }
  return keys
}

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
export function viewerOfVideo(v: { ytId: string; thumbs: readonly ThumbVersion[] }, title: string, now: number, D: ViewerClock, preview: string | null): ViewerInput | null {
  const ytId = v.ytId || null
  if (!v.thumbs.length) {
    if (!ytId) return null
    const one: ViewerVersion = { label: 'Capa atual', current: true, archived: null, youtubeId: ytId, caption: 'Capa atual (no ar): a thumbnail que o YouTube mostra agora', from: '', to: 'agora', preview }
    return { title, versions: [one], start: 0 }
  }
  const letter = imageLetters(v.thumbs)
  const versions = v.thumbs.map((t, i): ViewerVersion => {
    const nx = v.thumbs[i + 1]
    const label = 'Capa ' + (letter.get(t.key) ?? t.key)
    const from = D.dmhm(t.first_seen), to = nx ? D.dmhm(nx.first_seen) : 'agora'
    const lived = D.dur(Math.max(0, (nx ? nx.first_seen : now) - t.first_seen))
    return {
      label, current: t.current, archived: t.blobUrl ?? null, youtubeId: t.current ? ytId : null,
      caption: `${label}${t.current ? ' (no ar)' : ''}: ${from} até ${to}; no ar por ${lived}`,
      from, to, preview: t.blobUrl ?? (t.current ? preview : null),
    }
  })
  const cur = versions.findIndex(x => x.current)
  return { title, versions, start: cur >= 0 ? cur : versions.length - 1 }
}
