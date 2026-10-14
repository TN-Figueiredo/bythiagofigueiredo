import { DAY, spDateOf } from '../time'
import { median } from '../stats'
import { RULES } from '../rules'
import { MEASURE_RULES } from './regras'
import { medido, naoMedido, type FaltaDeMarca, type Formato, type Medida } from './tipos'

/**
 * M11 (o criador responde) e M12 (peso do comentário de topo). Puro. Os insumos vêm do leitor da Tarefa 15, que só lê
 * `creator_replied`, `likes`, `status` e ids: nenhum texto nem autor passa por aqui.
 */
export type StatusDoRetrato = 'ok' | 'sem_comentarios' | 'desligados' | 'erro'

export interface VideoParaResposta {
  formato: Formato | null
  idadeDias: number
  retrato30: StatusDoRetrato | null
  algumComRespostaDoCriador: boolean
}

/** O nome do campo é `com`, nunca "sem": o que a medida não viu não é afirmado (a frase "não vimos resposta" é da E5). */
export interface ValorResposta { com: number; total: number; pct: number | null }

export function criadorResponde(
  videos: readonly VideoParaResposta[],
  o: { formato: Formato; coletaDesdeMs: number | null; agoraMs: number },
): Medida<ValorResposta> {
  const c = MEASURE_RULES.comments
  if (o.coletaDesdeMs === null) return naoMedido('retrato_ausente')
  const fecha = o.coletaDesdeMs + 30 * DAY
  if (o.agoraMs < fecha) return naoMedido('fecha_em', { fechaEm: spDateOf(fecha) })
  const base = videos.filter(v => v.formato === o.formato && v.idadeDias <= c.windowDays && v.retrato30 === 'ok')
  if (base.length < c.minVideos) return naoMedido('poucos_videos', { n: base.length, minimo: c.minVideos })
  const com = base.filter(v => v.algumComRespostaDoCriador).length
  const total = base.length
  return medido(
    { com, total, pct: total >= c.pctFromN ? com / total : null },
    total,
    { de: spDateOf(o.agoraMs - c.windowDays * DAY), ate: spDateOf(o.agoraMs), dias: c.windowDays },
  )
}

export interface EntradaPeso {
  marco: 7 | 30
  retrato: StatusDoRetrato | null
  maiorCurtidasDeComentario: number | null
  curtidasDoVideoNaMarca: number | null
  likesHiddenNaMarca: boolean | null
  marca: 'gravada' | 'aguardando' | FaltaDeMarca
}

export function pesoDoComentarioDeTopo(e: EntradaPeso): Medida<number> {
  if (e.retrato !== 'ok' || e.maiorCurtidasDeComentario === null) return naoMedido('retrato_ausente')
  if (e.marca !== 'gravada' && e.marca !== 'aguardando') return naoMedido(e.marca)
  if (e.marca === 'aguardando') return naoMedido('aguardando_calculo')
  if (e.curtidasDoVideoNaMarca === null) return naoMedido(e.likesHiddenNaMarca === true ? 'curtidas_ocultas' : 'sem_reacao_publica')
  // Menos de 100 curtidas no vídeo também cobre o divisor zero.
  if (e.curtidasDoVideoNaMarca < MEASURE_RULES.comments.minVideoLikes) return naoMedido('poucas_curtidas')
  return medido(e.maiorCurtidasDeComentario / e.curtidasDoVideoNaMarca, 1, { de: null, ate: null, dias: e.marco })
}

/** Mediana dos medidos; quem chama separa longos e Shorts antes. */
export function pesoDoComentarioDeTopoDoCanal(valores: readonly Medida<number>[]): Medida<number> {
  const xs = valores.flatMap(m => (m.estado === 'medido' ? [m.valor] : []))
  const minimo = RULES.weakBase
  if (xs.length < minimo) return naoMedido('poucos_videos', { n: xs.length, minimo })
  const md = median(xs)
  if (md === null) return naoMedido('poucos_videos', { n: 0, minimo })
  return medido(md, xs.length, { de: null, ate: null, dias: null })
}
