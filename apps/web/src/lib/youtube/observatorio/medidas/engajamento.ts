import { DAY, spDateOf } from '../time'
import { median } from '../stats'
import { RULES } from '../rules'
import { MEASURE_RULES } from './regras'
import { medido, naoMedido, type Formato, type Medida, type Nota } from './tipos'

/** M7: engajamento (curtidas e comentários por view). Puro. */
export interface EntradaEngajamento {
  views30: number | null; likes30: number | null; comments30: number | null; temMarca30: boolean
  viewsHoje: number | null; likesHoje: number | null; commentsHoje: number | null
  likesHidden: boolean | null; commentsDisabled: boolean | null
  idadeDias: number
  agendadoOuNoAr: boolean
}
export interface ValorEngajamento {
  taxa: number
  curtidasPorView: number | null
  comentariosPorView: number | null
  base: 'idade_30' | 'total_de_hoje'
}

/**
 * Zero com o sinalizador nulo vale como nulo: a E1 grava `likes_hidden` e `comments_disabled` como booleano em toda leitura
 * com estatísticas, então nulo quer dizer "ainda não relido depois da E1", e `false` quer dizer "relido, e o zero é zero medido".
 */
function reacao(valor: number | null, ocultoOuDesligado: boolean | null): number | null {
  if (valor === null || !Number.isFinite(valor)) return null
  if (ocultoOuDesligado === true) return null
  if (valor === 0 && ocultoOuDesligado === null) return null
  return valor
}

export function engajamentoDoVideo(e: EntradaEngajamento): Medida<ValorEngajamento> {
  if (e.agendadoOuNoAr) return naoMedido('fecha_em')
  const notas: Nota[] = []
  let views: number | null, likes: number | null, comments: number | null
  let base: ValorEngajamento['base']
  if (e.temMarca30) {
    ;[views, likes, comments, base] = [e.views30, e.likes30, e.comments30, 'idade_30']
  } else if (e.idadeDias <= MEASURE_RULES.engagement.todayMaxAgeDays) {
    ;[views, likes, comments, base] = [e.viewsHoje, e.likesHoje, e.commentsHoje, 'total_de_hoje']
    notas.push({ tipo: 'total_de_hoje' })
  } else return naoMedido('sem_v30')
  if (views === null || !Number.isFinite(views)) return naoMedido('sem_leitura')
  if (views < MEASURE_RULES.engagement.minViews) return naoMedido('poucas_views', { notas })
  const l = reacao(likes, e.likesHidden), c = reacao(comments, e.commentsDisabled)
  if (l === null && c === null) return naoMedido('sem_reacao_publica', { notas })
  if (c === null) notas.push({ tipo: 'so_curtidas' })
  if (l === null) notas.push({ tipo: 'so_comentarios' })
  const taxa = ((l ?? 0) + (c ?? 0)) / views
  return medido(
    { taxa, curtidasPorView: l === null ? null : l / views, comentariosPorView: c === null ? null : c / views, base },
    1,
    { de: null, ate: null, dias: base === 'idade_30' ? 30 : e.idadeDias },
    notas,
  )
}

export interface VideoParaEngajamento {
  formato: Formato | null
  wasLive: boolean | null
  agendadoOuNoAr: boolean
  engajamento: Medida<ValorEngajamento>
}

type Grupo = { base: ValorEngajamento['base']; componente: 'os_dois' | 'so_curtidas' | 'so_comentarios' }
const componenteDe = (notas: Nota[]): Grupo['componente'] =>
  notas.some(n => n.tipo === 'so_curtidas') ? 'so_curtidas' : notas.some(n => n.tipo === 'so_comentarios') ? 'so_comentarios' : 'os_dois'

/** Mediana das taxas medidas da mesma base e do mesmo componente: nunca mistura 30 dias com total de hoje. */
export function engajamentoDoCanal(videos: readonly VideoParaEngajamento[], o: { formato: Formato; agoraMs?: number }): Medida<number> {
  const semFormato = videos.filter(v => v.formato === null).length
  const doFormato = videos.filter(v => v.formato === o.formato)
  const agendados = doFormato.filter(v => v.agendadoOuNoAr).length
  const aoVivo = doFormato.filter(v => !v.agendadoOuNoAr && v.wasLive === true).length
  const notas: Nota[] = []
  if (aoVivo) notas.push({ tipo: 'ao_vivo_fora', n: aoVivo })
  if (semFormato) notas.push({ tipo: 'formato_nao_confirmado_fora', n: semFormato })
  if (agendados) notas.push({ tipo: 'agendado_fora', n: agendados })
  const grupos = new Map<string, { g: Grupo; taxas: number[] }>()
  for (const v of doFormato) {
    if (v.agendadoOuNoAr || v.wasLive === true || v.engajamento.estado !== 'medido') continue
    const g: Grupo = { base: v.engajamento.valor.base, componente: componenteDe(v.engajamento.notas) }
    const k = g.base + '|' + g.componente
    const atual = grupos.get(k) ?? { g, taxas: [] }
    atual.taxas.push(v.engajamento.valor.taxa)
    grupos.set(k, atual)
  }
  const ordem = (x: { g: Grupo; taxas: number[] }) => (x.g.base === 'idade_30' ? 0 : 1) * 3 + (x.g.componente === 'os_dois' ? 0 : x.g.componente === 'so_curtidas' ? 1 : 2)
  const melhor = [...grupos.values()].sort((a, b) => b.taxas.length - a.taxas.length || ordem(a) - ordem(b))[0]
  const minimo = RULES.weakBase
  if (!melhor || melhor.taxas.length < minimo) return naoMedido('poucos_videos', { n: melhor?.taxas.length ?? 0, minimo, notas })
  if (melhor.g.base === 'total_de_hoje') notas.push({ tipo: 'total_de_hoje' })
  if (melhor.g.componente === 'so_curtidas') notas.push({ tipo: 'so_curtidas' })
  if (melhor.g.componente === 'so_comentarios') notas.push({ tipo: 'so_comentarios' })
  const md = median(melhor.taxas)
  if (md === null) return naoMedido('poucos_videos', { n: 0, minimo, notas })
  const ate = o.agoraMs ?? null
  return medido(md, melhor.taxas.length, { de: ate === null ? null : spDateOf(ate - MEASURE_RULES.channelWindowDays * DAY), ate: ate === null ? null : spDateOf(ate), dias: null }, notas)
}
