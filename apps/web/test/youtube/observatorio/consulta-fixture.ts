// Mundo das tarefas da consulta (A4 R3): o oráculo do Observatório, as medidas do site montadas à mão e um pedido padrão.
import { canalWorld } from './canal-fixture'
import { medido, naoMedido, type Medida } from '@/lib/youtube/observatorio/medidas/tipos'
import type { ValorEngajamento } from '@/lib/youtube/observatorio/medidas/engajamento'
import type { MedidasDoCanal } from '@/lib/youtube/observatorio/medidas/do-canal'
import type { InfoDoVideo, MedidasDoSite } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-site'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import type { Observatory } from '@/lib/youtube/observatorio'
import type { EntradaDoConjunto, PedidoDaConsulta } from '@/lib/youtube/observatorio/consulta/tipos'

export const J = { de: null, ate: null, dias: 30 }
export const m7Taxa = (taxa: number, base: ValorEngajamento['base'] = 'idade_30'): Medida<ValorEngajamento> =>
  medido({ taxa, curtidasPorView: taxa, comentariosPorView: null, base }, 1, J)

export interface Sobras {
  /** m7 por id de vídeo; o que não vem sai `poucas_views`. */
  m7?: Record<string, Medida<ValorEngajamento>>
  info?: Record<string, Partial<InfoDoVideo>>
  /** canais que não carregaram, com a causa */
  naoCarregou?: Record<string, string>
  semVideos?: boolean
}

export function medidasDe(obs: Observatory, o: Sobras = {}): MedidasDoSite {
  const porCanal: MedidasDoSite['porCanal'] = new Map()
  const videos = new Map<string, InfoDoVideo>()
  for (const c of obs.channels.filter(c => !c.own)) {
    if (o.naoCarregou?.[c.id]) { porCanal.set(c.id, { naoCarregou: o.naoCarregou[c.id] as never }); continue }
    const porVideo = new Map<string, unknown>()
    for (const v of obs.videos.filter(v => v.ch === c.id)) {
      porVideo.set(v.id, { formato: v.isShort === null ? null : v.fmt, m7: o.m7?.[v.id] ?? naoMedido('poucas_views') })
      videos.set(v.id, { wasLive: false, missingSince: null, likesHidden: false, commentsDisabled: false, ...o.info?.[v.id] })
    }
    porCanal.set(c.id, { porVideo, porFormato: {}, falhas: [] } as unknown as MedidasDoCanal)
  }
  return { porCanal, extras: { lido: false, causa: 'tempo_esgotado' }, falhas: [], esgotou: 0, ...(o.semVideos ? {} : { videos }), lidoEmMaisAntigo: null }
}

export const pedido = (o: Partial<PedidoDaConsulta> = {}): PedidoDaConsulta => ({
  formato: 'todos', janelaIdade: 'todas', metricas: ['views', 'likes', 'comentarios', 'vpd7', 'multiplicador', 'engajamento', 'inscritos'],
  ordenarPor: 'multiplicador', direcao: 'desc', limite: 20, incluirBaseFraca: false, ...o,
})

export function mundo(mut?: (ds: Dataset) => void, sobras: Sobras | ((obs: Observatory) => Sobras) = {}, ped: Partial<PedidoDaConsulta> = {}) {
  const w = canalWorld(mut ? ds => mut(ds) : undefined)
  const s = typeof sobras === 'function' ? sobras(w.obs) : sobras
  const entrada: EntradaDoConjunto = { obs: w.obs, medidas: medidasDe(w.obs, s), marcados: null, agoraMs: w.obs.NOW }
  return { ...w, entrada, p: pedido(ped) }
}
