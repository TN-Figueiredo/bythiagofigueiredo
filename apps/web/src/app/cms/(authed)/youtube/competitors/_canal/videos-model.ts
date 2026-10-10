/**
 * Modelo dos vídeos da página do canal (spec 5.4, 5.6 e 5.9). Puro: tudo vem do motor (`obs`); nada de número recalculado.
 * Dado ausente é `null` no tipo e a frase do motivo vai em `viewsMissing`, `semMedida` ou `notas`; nunca zero, nunca traço.
 *
 * O vídeo antigo (fora dos acompanhados) vai enxuto: só os campos de `ChannelVideoView`, sem série nem versões.
 * Não chama nada que agregue entre canais (o conjunto de um canal lança nisso): só `channel`, `videos`, `video`,
 * `multiplier`, `multiplierCard`, `changesIn`, `fmt`, `date`, `RULES` e `SERIES_START_LABEL`.
 */
import type { Observatory } from '@/lib/youtube/observatorio'
import type { ObsChannel, ObsVideo, UndatedVideo } from '@/lib/youtube/observatorio/types'
import { tierOf } from '@/lib/youtube/observatorio/rules'
import { pinViewOf, type PinView } from '../_chrome/pin-view'
import { viewsMissingText } from '../_chrome/views-text'
import { vpdText } from './numeros'

export type Grupo = 'acompanhado' | 'fixado-antigo' | 'antigo' | 'sem-data'

export interface ChannelVideoView {
  id: string; ytId: string; title: string; url: string; grupo: Grupo
  // brutos, para filtrar e ordenar no navegador
  pub: number | null; views: number | null; vpd7: number | null; mult: number | null
  isShort: boolean | null; pinned: boolean; tracked: boolean; dur: number | null; likes: number | null; comments: number | null; swaps: number
  // prontos para a tela
  thumbSrc: string | null; durText: string | null; ageText: string | null; pubISO: string | null; pubTitle: string | null
  viewsText: string | null; viewsMissing: string | null          // "sem contagem: <motivo>"
  vpdText: string | null; multText: string | null; multTier: 'mid' | 'high' | 'top' | null; multWord: string | null
  /** Quando faltam views/dia E múltiplo: a frase única que ocupa as duas colunas. null = há pelo menos um dos dois. */
  semMedida: string | null
  likesText: string | null; commentsText: string | null
  badges: string[]                                               // "fixado", "sem duração", "formato não confirmado", "sem data", "2 trocas"
  /** Topo do menu "Ações do vídeo": a base do múltiplo e o motivo de cada "não medido" do cartão. */
  notas: string[]
  pin: PinView | null
}

export interface CanalVideosView { videos: ChannelVideoView[]; nota: string; semVideos: string | null }

const NB = ' '
const WORD = { mid: 'alto', high: 'muito alto', top: 'topo' } as const

function durText(sec: number | null): string | null {
  if (sec == null) return null
  const s = Math.round(sec), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  const p2 = (n: number) => (n < 10 ? '0' : '') + n
  return h ? `${h}:${p2(m)}:${p2(r)}` : `${p2(m)}:${p2(r)}`
}

export function buildCanalVideos(obs: Observatory, channelId: string): CanalVideosView {
  const ch: ObsChannel | undefined = obs.channel(channelId)
  const F = obs.fmt, D = obs.date
  const nota = 'Múltiplo = views do vídeo ÷ mediana dos outros vídeos do mesmo formato e da mesma faixa de idade do canal. '
    + 'De 2 a 5, alto; de 5 a 10, muito alto; 10 ou mais, topo. '
    + `Views por dia = média entre a primeira e a última contagem diária dos últimos 7 dias; a contagem diária existe desde ${obs.SERIES_START_LABEL} e só para os vídeos acompanhados.`
  if (!ch) return { videos: [], nota, semVideos: 'Este canal ainda não tem vídeos sincronizados.' }

  const num = (n: number | null) => (n == null ? null : F.num(n).replace(/ (mil|mi)$/, NB + '$1'))
  const thumbOf = (ytId: string, cur?: string | null) => cur ?? (ytId ? `https://i.ytimg.com/vi/${ytId}/mqdefault.jpg` : null)
  const swapsOf = (id: string) => obs.changesIn({ days: 30, video: id }).filter(c => c.type !== 'desc').length
  const noTitle = 'sem título'

  const dated = obs.videos.filter(v => v.ch === ch.id).sort((a, b) => b.pub - a.pub)
  const out: ChannelVideoView[] = []

  for (const dv of dated) {
    const v: ObsVideo = dv
    const grupo: Grupo = v.tracked ? 'acompanhado' : v.pinned ? 'fixado-antigo' : 'antigo'
    const pinned = v.pinned === true
    const vpd7 = dv.vpd7
    const m = obs.multiplier(v.id)
    const mult = m.value
    const tier = tierOf(mult)
    const swaps = swapsOf(v.id)
    const viewsMissing = v.views == null ? viewsMissingText(ch, D.dmhm) : null

    const semMedida = grupo === 'fixado-antigo' ? 'fixado antigo: sem views/dia nem múltiplo'
      : vpd7 == null && mult == null ? 'views/dia e múltiplo: não medido' : null

    const notas: string[] = []
    if (mult != null) {
      const card = obs.multiplierCard(v.id)
      notas.push(`contra os ${v.fmt === 'short' ? 'Shorts' : 'longos'} do canal ${card.ref}, ${card.nText.slice(1, -1)}${m.weak ? `; base fraca (n = ${m.n})` : ''}`)
    } else if (grupo === 'acompanhado' && m.method != null && m.n === 0) {
      notas.push('sem comparação: nenhum vídeo do canal na mesma faixa de idade')
    } else if (grupo === 'acompanhado' && m.reason === 'mediana zero') {
      notas.push('sem comparação: a mediana do canal nessa faixa é 0 views')
    }
    if (v.comments == null) notas.push('Comentários: o YouTube não devolveu a contagem.')
    if (!v.tracked) notas.push(`Este vídeo está fora dos ${ch.video_limit} acompanhados, então não há contagem diária dele.`)
    if (!v.tracked && v.viewsAt != null) notas.push(`Views contadas em ${D.dmy(v.viewsAt)}.`)
    if (pinned && v.pinState === 'aguardando-primeira') notas.push('Fixado: aguardando a primeira sincronização.')
    if (pinned && v.pinState === 'sem-resposta') notas.push('Fixado: o YouTube não devolveu este vídeo.')

    const badges: string[] = []
    if (pinned) badges.push('fixado')
    if (v.dur == null) badges.push('sem duração')
    if (v.isShort == null) badges.push('formato não confirmado')
    if (swaps) badges.push(swaps === 1 ? '1 troca' : `${swaps} trocas`)

    out.push({
      id: v.id, ytId: v.ytId, title: v.title.trim() ? v.title : noTitle, url: v.url, grupo,
      pub: v.pub, views: v.views, vpd7, mult, isShort: v.isShort, pinned, tracked: v.tracked, dur: v.dur, likes: v.likes, comments: v.comments, swaps,
      thumbSrc: thumbOf(v.ytId, v.thumbs.find(t => t.current)?.blobUrl ?? null),
      durText: durText(v.dur), ageText: F.age(v), pubISO: new Date(v.pub).toISOString(), pubTitle: `${D.dmy(v.pub)} ${D.hm(v.pub)} (São Paulo)`,
      viewsText: num(v.views), viewsMissing,
      vpdText: vpdText(vpd7, F.num), multText: mult == null ? null : F.mult(mult), multTier: tier, multWord: tier ? WORD[tier] : null,
      semMedida, likesText: num(v.likes), commentsText: num(v.comments), badges, notas, pin: pinViewOf(obs, v),
    })
  }

  for (const u of ch.undated as UndatedVideo[]) {
    const notas = ['sem data de publicação: sem idade nem múltiplo']
    if (u.comments == null) notas.push('Comentários: o YouTube não devolveu a contagem.')
    if (u.pinned) notas.push('Fixado: sem data de publicação, sem views por dia.')
    const badges: string[] = []
    if (u.pinned) badges.push('fixado')
    if (u.dur == null) badges.push('sem duração')
    if (u.isShort == null) badges.push('formato não confirmado')
    badges.push('sem data')
    out.push({
      id: u.id, ytId: u.ytId, title: u.title?.trim() ? u.title : noTitle, url: u.url, grupo: 'sem-data',
      pub: null, views: u.views, vpd7: null, mult: null, isShort: u.isShort, pinned: u.pinned, tracked: false, dur: u.dur, likes: u.likes, comments: u.comments, swaps: 0,
      thumbSrc: thumbOf(u.ytId), durText: durText(u.dur), ageText: null, pubISO: null, pubTitle: null,
      viewsText: num(u.views), viewsMissing: u.views == null ? viewsMissingText(ch, D.dmhm) : null,
      vpdText: null, multText: null, multTier: null, multWord: null,
      semMedida: 'views/dia e múltiplo: não medido', likesText: num(u.likes), commentsText: num(u.comments), badges, notas, pin: null,
    })
  }

  return { videos: out, nota, semVideos: out.length ? null : 'Este canal ainda não tem vídeos sincronizados.' }
}
