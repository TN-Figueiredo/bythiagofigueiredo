// apps/web/src/lib/youtube/observatorio/referencias.ts
// A5 · E5a · R1. Número de Referências: o vídeo típico (mediana) e a faixa (p25 a p75) de 90 dias de cada canal.
// Puro, neutro (a Cowork usa a mesma regra): sem server-only, sem relógio (a idade vem de ObsVideo.ageDays e viewsAt/pub).
import { median, quant } from './stats'
import { DAY, H } from './time'
import type { Fmt, ObsChannel, ObsVideo } from './types'

export const REGRAS_REFERENCIAS = {
  janelaDias: 90, idadeMinimaDias: 7, minVideosFaixa: 5, minVideosProvisoria: 3, corteEstreita: 2, corteMedia: 6, coletaVelhaHoras: 48,
} as const

export type MotivoReferencia = 'ainda_nao_coletado' | 'coleta_velha' | 'so_videos_novos' | 'sem_videos_90d' | 'poucos_videos' | 'janela_parcial'
export type ClasseFaixa = 'estreita' | 'media' | 'larga'
export type ReferenciaDoCanal =
  | { canal: string; tipo: 'ok'; mediana: number; p25: number; p75: number; razao: number | null; classe: ClasseFaixa; k: number }
  | { canal: string; tipo: 'prov'; mediana: number; k: number; desde?: number }
  | { canal: string; tipo: 'nm'; motivo: MotivoReferencia; k: number; desde?: number }

/** Dias inteiros entre a publicação e a leitura das views (não entre a publicação e hoje). Sem viewsAt, cai em ageDays. */
const idadeNaLeitura = (v: ObsVideo): number => (v.viewsAt != null ? Math.floor((v.viewsAt - v.pub) / DAY) : v.ageDays)

/**
 * `videos` traz todos os formatos do canal (a janela parcial precisa deles); o filtro do escopo (`p.fmt`) é interno.
 * `p.syncDoSite` = última coleta boa do site (obs.sync.last); null = nenhuma.
 */
export function referenciaDoCanal(c: ObsChannel, videos: readonly ObsVideo[], p: { fmt: Fmt; syncDoSite: number | null }): ReferenciaDoCanal {
  const R = REGRAS_REFERENCIAS
  const nm = (motivo: MotivoReferencia, k: number, desde?: number): ReferenciaDoCanal =>
    desde === undefined ? { canal: c.id, tipo: 'nm', motivo, k } : { canal: c.id, tipo: 'nm', motivo, k, desde }
  const last = c.sync.last
  if (last == null || c.sync.state === 'backfill') return nm('ainda_nao_coletado', 0)
  if (p.syncDoSite != null && p.syncDoSite - last > R.coletaVelhaHoras * H) return nm('coleta_velha', 0, last)

  const janela = videos.filter(v => v.fmt === p.fmt && v.tracked && v.ageDays <= R.janelaDias)
  const naoLido = (v: ObsVideo) => v.views == null || !Number.isFinite(v.views)
  const lidos = janela.filter(v => !naoLido(v))
  const entram = lidos.filter(v => idadeNaLeitura(v) >= R.idadeMinimaDias)
  const k = entram.length
  const nulos = janela.filter(naoLido).length
  if ((janela.length > 0 && nulos === janela.length) || (k < R.minVideosFaixa && nulos > 0)) return nm('ainda_nao_coletado', k)
  // Janela de 90 dias só em parte coberta: o canal tem tantos vídeos acompanhados quanto o limite e o mais velho não chega a 90 dias.
  // Vale para todo k (portão Phil P1): com poucos vídeos do escopo, "sem vídeos" ou "poucos vídeos" seria afirmação falsa.
  const acompanhados = videos.filter(v => v.tracked)
  const limite = Math.min(c.video_limit, 200)
  let desdeParcial: number | null = null
  if (acompanhados.length >= limite && acompanhados.length > 0) {
    const maisVelho = acompanhados.reduce((a, b) => (b.pub < a.pub ? b : a))
    if (maisVelho.ageDays < R.janelaDias) desdeParcial = maisVelho.pub
  }
  if (k < R.minVideosProvisoria && desdeParcial != null) return nm('janela_parcial', k, desdeParcial)
  if (k === 0) return nm(lidos.length > 0 ? 'so_videos_novos' : 'sem_videos_90d', 0)
  if (k < R.minVideosProvisoria) return nm('poucos_videos', k)

  const views = entram.map(v => v.views as number)
  const mediana = median([...views]) as number
  if (desdeParcial != null) return { canal: c.id, tipo: 'prov', mediana, k, desde: desdeParcial }
  if (k < R.minVideosFaixa) return { canal: c.id, tipo: 'prov', mediana, k }

  const p25 = quant([...views], 0.25) as number
  const p75 = quant([...views], 0.75) as number
  const razao = p25 === 0 ? null : p75 / p25
  const classe: ClasseFaixa = razao === null ? 'larga' : razao <= R.corteEstreita ? 'estreita' : razao <= R.corteMedia ? 'media' : 'larga'
  return { canal: c.id, tipo: 'ok', mediana, p25, p75, razao, classe, k }
}
