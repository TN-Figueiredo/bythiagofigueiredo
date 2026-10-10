/**
 * Modelo da página do canal: junta o cabeçalho, os vídeos e o estado da URL. Puro: tudo vem do motor do conjunto de um
 * canal (`scope: 'canal'`), que lança em tudo que agrega entre canais; este arquivo não chama nenhum deles.
 */
import type { Observatory } from '@/lib/youtube/observatorio'
import { link } from '@/lib/youtube/observatorio/links'
import { buildCanalHeader, type CanalHeaderView } from './header-model'
import { buildCanalVideos, type CanalVideosView } from './videos-model'
import { parseCanalState, type CanalState } from './params'

/** A aba Trocas nasce na Tarefa 7; até lá o tipo não tem valor. */
export type CanalTrocasView = never

export interface CanalView {
  header: CanalHeaderView
  videos: CanalVideosView
  trocas: CanalTrocasView | null
  state: CanalState
  /** Canal próprio: continua no painel lateral de Canais até a A4 (emenda 26); a página redireciona. */
  own: boolean
  /** Para onde o primeiro item da trilha leva: Canais, ou a tela de origem (Outliers, Mudanças) com o filtro que ela tinha. */
  canaisHref: string
  /** O canal ainda está na primeira sincronização (vídeos chegando): "Sincronizar só este canal" só avisa. */
  backfilling: boolean
  /** O texto desse primeiro item: "Canais", "Outliers" ou "Mudanças". */
  origemText: string
}

/** O `back` só vale como query de volta: começa por "?" (nunca uma URL inteira). */
const backOf = (v: string | undefined) => (typeof v === 'string' && v.startsWith('?') ? v : '')

export function buildCanalView(obs: Observatory, channelId: string, sp: Record<string, string | undefined>): CanalView | null {
  const header = buildCanalHeader(obs, channelId)
  if (!header) return null
  const own = obs.channel(channelId)?.own === true
  let canaisHref = link.canais(), origemText = 'Canais'
  if (sp.from === 'outliers') { canaisHref = link.outliers() + backOf(sp.back); origemText = 'Outliers' }
  else if (sp.from === 'mudancas') { canaisHref = link.mudancas() + backOf(sp.back); origemText = 'Mudanças' }
  return { header, videos: buildCanalVideos(obs, channelId), trocas: null, state: parseCanalState(sp), own, backfilling: obs.channel(channelId)?.sync.state === 'backfill', canaisHref, origemText }
}
