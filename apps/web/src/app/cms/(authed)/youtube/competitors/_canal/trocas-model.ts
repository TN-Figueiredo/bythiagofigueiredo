/**
 * Modelo da aba Trocas da página do canal (spec 5.7): um cartão por vídeo com as trocas de título e thumbnail dos últimos 30 dias
 * (a descrição fica fora, como no número do cabeçalho). Puro: tudo vem do motor (`obs`); a frase de efeito é a do Histórico.
 *
 * Não chama nada que agregue entre canais (o conjunto de um canal lança nisso): só `channel`, `video`, `changesIn`, `effect`,
 * `fmt`, `date`, `SYNC`, `NOW` e `link`.
 */
import type { Observatory } from '@/lib/youtube/observatorio'
import type { ObsChange } from '@/lib/youtube/observatorio/changes'
import { link } from '@/lib/youtube/observatorio/links'
import { effLine } from '../_chrome/effect-view'
import type { ViewerInput } from '../_chrome/thumb-viewer/viewer-model'
import { viewerOfVideo } from '../_chrome/thumb-viewer/thumb-viewer-versions'

export interface TrocaView {
  id: string
  campo: 'Título trocado' | 'Thumbnail trocada'
  /** "visto pela 1ª vez há 9 dias (entre 28/09 09h e 28/09 15h)"; vai dentro de <time datetime={iso} title={quandoTitle}>. */
  quando: string
  quandoTitle: string
  /** ISO 8601 do instante, para <time datetime>. */
  iso: string
  /** Título: os dois textos. Thumbnail: a imagem, ou `semArquivo` quando ela não foi arquivada (nunca uma imagem inventada). */
  antes: { texto: string | null; thumb: string | null; semArquivo: boolean }
  agora: { texto: string | null; thumb: string | null }
  efeito: string
  /** O Histórico do vídeo já nesta troca. */
  href: string
  hrefLabel: string
}
export interface TrocaCard {
  videoId: string
  title: string
  thumbSrc: string | null
  /** O visualizador de thumbnail do vídeo (as versões do conjunto do canal, abrindo na atual); null = nem versão nem id do YouTube. */
  viewer: ViewerInput | null
  /** "2 trocas neste vídeo" (a tela só mostra com duas ou mais). */
  contagem: string
  /** Uma troca: o Histórico já nela. Duas ou mais: o Histórico do vídeo todo, sem troca escolhida. */
  href: string
  hrefLabel: string
  trocas: TrocaView[]
}
export interface CanalTrocasView {
  /** "7 em 30 d", na aba; vazio com o canal na primeira sincronização (nada foi comparado ainda: nem zero). */
  tabCount: string
  titulo: string
  intro: string
  cards: TrocaCard[]
  /** A frase da aba vazia (ou do canal ainda em sincronização inicial); null quando há cartões. */
  vazio: string | null
  total: number
  mudancasLink: { href: string; text: string } | null
}

const TITULO = 'Trocas de título e thumbnail nos últimos 30 dias'
const INTRO = 'O Histórico do vídeo é a tela que mostra o efeito de cada troca.'
const VAZIO = 'Nenhuma troca de título ou thumbnail nos últimos 30 dias.'
const BACK = '?tab=trocas'

/** Os ids de até 100 vídeos em torno de `i`: a vizinhança do Anterior/Próximo do Histórico (a janela encosta no começo e no fim). */
function vizinhanca(ids: readonly string[], i: number): string[] {
  const a = Math.max(0, Math.min(i - 50, ids.length - 100))
  return ids.slice(a, a + 100)
}

export function buildCanalTrocas(obs: Observatory, channelId: string): CanalTrocasView {
  const D = obs.date
  const ch = obs.channel(channelId)
  const backfill = ch?.sync.state === 'backfill'
  const base = { titulo: TITULO, intro: INTRO }
  if (!ch || backfill) {
    const next = obs.SYNC.next
    return {
      ...base, tabCount: backfill ? '' : '0 em 30 d', cards: [], total: 0, mudancasLink: null,
      vazio: backfill
        ? `Trocas são detectadas comparando versões entre sincronizações, então ainda não há o que comparar.${next != null ? ` A primeira detecção possível é na sincronização das ${D.hm(next)}.` : ''}`
        : VAZIO,
    }
  }

  const trocas = obs.changesIn({ days: 30, channel: channelId })
    .filter(c => c.type === 'title' || c.type === 'thumb')
    .sort((a, b) => b.at - a.at || (a.id < b.id ? -1 : 1))
  const porVideo = new Map<string, ObsChange[]>()
  for (const c of trocas) { const l = porVideo.get(c.video); if (l) l.push(c); else porVideo.set(c.video, [c]) }
  const videoIds = [...porVideo.keys()]

  const hrefDe = (videoId: string, i: number, troca?: string) =>
    link.historico(videoId, { from: 'canais', canal: channelId, back: BACK, ids: vizinhanca(videoIds, i), pos: i + 1, tot: videoIds.length, troca })

  const cards: TrocaCard[] = videoIds.map((videoId, i) => {
    const v = obs.video(videoId)!
    const lista = porVideo.get(videoId)!
    const title = v.title.trim() ? v.title : 'sem título'
    const versaoThumb = (id: string) => v.thumbs.find(t => t.id === id)?.blobUrl ?? null
    const views: TrocaView[] = lista.map(c => {
      const titulo = c.type === 'title'
      const antesThumb = titulo ? null : versaoThumb(c.fromId)
      return {
        id: c.id,
        campo: titulo ? 'Título trocado' : 'Thumbnail trocada',
        quando: `${titulo ? 'visto' : 'vista'} pela 1ª vez ${c.agoShort} (${c.whenText})`,
        quandoTitle: `${D.dmhm(c.at)} (São Paulo)`,
        iso: new Date(c.at).toISOString(),
        antes: { texto: titulo ? String(c.before) : null, thumb: antesThumb, semArquivo: !titulo && antesThumb == null },
        agora: { texto: titulo ? String(c.after) : null, thumb: titulo ? null : versaoThumb(c.toId) },
        efeito: effLine(obs, obs.effect(c.id)),
        href: hrefDe(videoId, i, c.id),
        hrefLabel: `Abrir o histórico do vídeo na troca de ${titulo ? 'título' : 'thumbnail'} de ${D.dm(c.at)}: ${title}`,
      }
    })
    const multi = views.length > 1
    const thumbSrc = v.thumbs.find(t => t.current)?.blobUrl ?? (v.ytId ? `https://i.ytimg.com/vi/${v.ytId}/mqdefault.jpg` : null)
    return {
      videoId, title, thumbSrc, viewer: viewerOfVideo(v, title, obs.NOW, D, thumbSrc),
      contagem: `${views.length} ${multi ? 'trocas' : 'troca'} neste vídeo`,
      href: multi ? hrefDe(videoId, i) : views[0]!.href,
      hrefLabel: `Abrir histórico do vídeo: ${title}`,
      trocas: views,
    }
  })

  const total = trocas.length
  return {
    ...base, tabCount: `${total} em 30 d`, cards, total,
    vazio: total ? null : VAZIO,
    mudancasLink: total ? { href: link.mudancas({ channel: channelId }), text: total === 1 ? 'Ver a troca em Mudanças' : `Ver as ${total} trocas em Mudanças` } : null,
  }
}
