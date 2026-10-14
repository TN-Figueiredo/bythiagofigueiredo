import { DAY, H, spDateOf } from '../time'
import { median } from '../stats'
import { RULES } from '../rules'
import { MEASURE_RULES } from './regras'
import { medido, naoMedido, type FaltaDeMarca, type Formato, type Medida, type Nota } from './tipos'

/**
 * M1: views de um vídeo numa idade fixa (1, 7 ou 30 dias). Puro: nada de banco, rede nem relógio.
 * Não existe ponto virtual de 0 views na publicação (plano 4.2); o cálculo do múltiplo das telas continua em `multiplier.ts`.
 */
export interface Leitura { t: number; views: number; likes: number | null; comments: number | null }

export type IdadeDeMarca = 1 | 7 | 30

export function baseDaIdade(v: { publishedAt: string | null; liveActualStartAt: string | null }): number | null {
  if (!v.publishedAt) return null
  const pub = Date.parse(v.publishedAt)
  if (!Number.isFinite(pub)) return null
  const live = v.liveActualStartAt ? Date.parse(v.liveActualStartAt) : NaN
  return Number.isFinite(live) && live > pub ? live : pub
}

export type ViewsNaIdade =
  | { medido: { views: number; likes: number | null; comments: number | null; antes: number; depois: number; gapHoras: number } }
  | { falta: 'sem_vizinha_antes' | 'sem_vizinha_depois' | 'distantes' }

const numeroOuNulo = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null)

/** Leituras válidas, ordenadas, uma por instante (a de maior `views`). */
function limpar(leituras: readonly Leitura[]): Leitura[] {
  const porT = new Map<number, Leitura>()
  for (const l of leituras) {
    if (!l || typeof l.t !== 'number' || !Number.isFinite(l.t) || typeof l.views !== 'number' || !Number.isFinite(l.views)) continue
    const atual = porT.get(l.t)
    if (!atual || l.views > atual.views) porT.set(l.t, l)
  }
  return [...porT.values()].sort((a, b) => a.t - b.t)
}

const interpolar = (a: number | null, b: number | null, f: number): number | null =>
  a === null || b === null ? null : Math.round(a + (b - a) * f)

export function viewsNaIdade(leituras: readonly Leitura[], baseMs: number, idadeDias: number, o: { maxGapHoras: number }): ViewsNaIdade {
  const alvo = baseMs + idadeDias * DAY
  const ls = limpar(leituras)
  let a: Leitura | null = null
  let b: Leitura | null = null
  for (const l of ls) {
    if (l.t <= alvo) a = l
    if (l.t >= alvo && !b) b = l
  }
  if (!a) return { falta: 'sem_vizinha_antes' }
  if (!b) return { falta: 'sem_vizinha_depois' }
  const gapMs = b.t - a.t
  if (gapMs > o.maxGapHoras * H) return { falta: 'distantes' }
  const f = gapMs === 0 ? 0 : (alvo - a.t) / gapMs
  const likesA = numeroOuNulo(a.likes), likesB = numeroOuNulo(b.likes)
  const comA = numeroOuNulo(a.comments), comB = numeroOuNulo(b.comments)
  return {
    medido: {
      views: Math.round(a.views + (b.views - a.views) * f),
      likes: interpolar(likesA, likesB, f),
      comments: interpolar(comA, comB, f),
      antes: a.t,
      depois: b.t,
      gapHoras: gapMs / H,
    },
  }
}

export interface PendenteDeMarca {
  videoId: string
  siteId: string
  idadeDias: IdadeDeMarca
  baseAt: number
  /** Texto de `base_at` como veio do banco, guardado sem conversão (microssegundos). */
  baseAtIso: string
  seriesTier: 'diaria' | 'semanal' | null
  motivoAnterior: FaltaDeMarca | null
  alvoAt: number
  discoveredAt: number | null
  missingSince: number | null
  viewsHidden: boolean | null
  likesHidden: boolean | null
  commentsDisabled: boolean | null
  primeiraLeituraAt: number | null
  ultimaLeituraAt: number | null
  /** `gap_crossed_pause` de `competitor_marks_pending`: o buraco cruza uma pausa de coleta feita de propósito. */
  cruzouPausa: boolean
  leituras: Leitura[]
}

export interface MarcaParaGravar {
  video_id: string
  age_days: IdadeDeMarca
  base_at: string
  views: number
  likes: number | null
  comments: number | null
  likes_hidden: boolean | null
  comments_disabled: boolean | null
  read_before_at: string
  read_after_at: string
}

export type DecisaoDeMarca =
  | { tipo: 'marca'; linha: MarcaParaGravar }
  | { tipo: 'falta'; reason: FaltaDeMarca; sinceAt: number | null }
  | { tipo: 'aguardar' }

const limiteDe = (idade: IdadeDeMarca): number => (idade === 1 ? MEASURE_RULES.maxGapHoursDay1 : MEASURE_RULES.maxGapHours)
/** Janela em que o sinalizador "oculto" ainda vale como explicação do número nulo. */
const SINALIZADOR_HORAS = 72

export function decidirMarca(p: PendenteDeMarca, agoraMs: number): DecisaoDeMarca {
  const limiteH = limiteDe(p.idadeDias)
  const r = viewsNaIdade(p.leituras, p.baseAt, p.idadeDias, { maxGapHoras: limiteH })
  if ('medido' in r) {
    const m = r.medido
    const dentro72 = agoraMs - p.alvoAt <= SINALIZADOR_HORAS * H
    return {
      tipo: 'marca',
      linha: {
        video_id: p.videoId,
        age_days: p.idadeDias,
        base_at: p.baseAtIso,
        views: m.views,
        likes: m.likes,
        comments: m.comments,
        likes_hidden: m.likes !== null ? false : p.likesHidden === true && dentro72 ? true : null,
        comments_disabled: m.comments !== null ? false : p.commentsDisabled === true && dentro72 ? true : null,
        read_before_at: new Date(m.antes).toISOString(),
        read_after_at: new Date(m.depois).toISOString(),
      },
    }
  }
  // Antes do prazo, qualquer leitura nova ainda pode virar a vizinha: nada é gravado e o par volta na execução seguinte.
  if (agoraMs < p.alvoAt + (limiteH + MEASURE_RULES.lateReadingHours) * H) return { tipo: 'aguardar' }

  if (p.primeiraLeituraAt === null) {
    return { tipo: 'falta', reason: p.viewsHidden === true ? 'views_ocultas' : 'sem_leitura', sinceAt: null }
  }
  if (p.primeiraLeituraAt > p.alvoAt) {
    const tarde = p.discoveredAt !== null && p.discoveredAt - p.baseAt > MEASURE_RULES.discoveredLateHours * H
    return { tipo: 'falta', reason: tarde ? 'descoberto_tarde' : 'leitura_comecou_depois', sinceAt: p.primeiraLeituraAt }
  }
  if (p.ultimaLeituraAt !== null && p.ultimaLeituraAt < p.alvoAt) {
    return { tipo: 'falta', reason: 'leitura_parou_antes', sinceAt: p.ultimaLeituraAt }
  }
  return { tipo: 'falta', reason: 'leituras_distantes', sinceAt: null }
}

/** A coleta falhou: a série existia antes do alvo, o vídeo está no ar, e a perda não estava registrada, nem foi aberta por pausa de propósito. */
export function marcaPerdida(p: PendenteDeMarca, reason: FaltaDeMarca): boolean {
  if (reason !== 'leituras_distantes' && reason !== 'leitura_parou_antes') return false
  if (p.primeiraLeituraAt === null || p.primeiraLeituraAt >= p.alvoAt) return false
  if (p.missingSince !== null) return false
  if (p.motivoAnterior === 'leituras_distantes' || p.motivoAnterior === 'leitura_parou_antes') return false
  if (p.cruzouPausa) return false
  return true
}

/** A perda deixa o disparo vermelho? Só nas idades de `MEASURE_RULES.lost.alarmAges`. */
export function perdaAvisa(p: PendenteDeMarca): boolean {
  const idades: readonly number[] = MEASURE_RULES.lost.alarmAges
  if (!idades.includes(p.idadeDias)) return false
  return !(p.idadeDias === 30 && p.seriesTier === 'semanal' && !MEASURE_RULES.lost.weeklyTier30Counts)
}

export interface MarcaLida {
  views: number
  likes: number | null
  comments: number | null
  readBeforeAt: number
  readAfterAt: number
  /** `age_base_at` gravado com a marca (ms). */
  ageBaseAt: number
}
export interface FaltaLida { reason: FaltaDeMarca; sinceAt: number | null; ageBaseAt: number }
export type ValorM1 = { views: number; gapHoras: number; fonte: 'marca' | 'serie' }

const diaSP = (ms: number | null): string | undefined => (ms === null ? undefined : spDateOf(ms))

export function m1DoVideo(e: {
  idadeDias: IdadeDeMarca; baseMs: number | null; agendadoOuNoAr: boolean; agoraMs: number
  marca: MarcaLida | null; falta: FaltaLida | null; leituras?: Leitura[]
}): Medida<ValorM1> {
  if (e.baseMs === null) return naoMedido('sem_publicacao')
  if (e.agendadoOuNoAr) return naoMedido('fecha_em')
  const alvo = e.baseMs + e.idadeDias * DAY
  const janela = { de: spDateOf(e.baseMs), ate: spDateOf(alvo), dias: e.idadeDias }
  // Marca ou motivo gravado com outra base não vale: a tarefa vai refazê-lo.
  const marca = e.marca && e.marca.ageBaseAt === e.baseMs ? e.marca : null
  const falta = e.falta && e.falta.ageBaseAt === e.baseMs ? e.falta : null
  if (marca) return medido({ views: marca.views, gapHoras: (marca.readAfterAt - marca.readBeforeAt) / H, fonte: 'marca' as const }, 1, janela)
  if (falta) return naoMedido(falta.reason, { desde: diaSP(falta.sinceAt) })
  if (e.agoraMs < alvo) return naoMedido('fecha_em', { fechaEm: spDateOf(alvo) })
  if (e.leituras) {
    const r = viewsNaIdade(e.leituras, e.baseMs, e.idadeDias, { maxGapHoras: limiteDe(e.idadeDias) })
    if ('medido' in r) return medido({ views: r.medido.views, gapHoras: r.medido.gapHoras, fonte: 'serie' as const }, 1, janela)
  }
  return naoMedido('aguardando_calculo')
}

export interface VideoComM1 {
  formato: Formato | null
  publicadoEm: number
  wasLive: boolean | null
  missingSince: number | null
  m1: Medida<ValorM1>
}

export function m1DoCanal(videos: readonly VideoComM1[], o: { formato: Formato; idadeDias: IdadeDeMarca; agoraMs: number }): Medida<number> {
  const janelaMs = MEASURE_RULES.channelWindowDays * DAY
  const dentro = videos.filter(v => o.agoraMs - v.publicadoEm <= janelaMs && o.agoraMs - v.publicadoEm >= 0)
  const semFormato = dentro.filter(v => v.formato === null).length
  const doFormato = dentro.filter(v => v.formato === o.formato)
  const aoVivo = doFormato.filter(v => v.wasLive === true).length
  const considerados = doFormato.filter(v => v.wasLive !== true)
  const medidos = considerados.filter(v => v.m1.estado === 'medido')
  const notas: Nota[] = []
  if (aoVivo) notas.push({ tipo: 'ao_vivo_fora', n: aoVivo })
  if (semFormato) notas.push({ tipo: 'formato_nao_confirmado_fora', n: semFormato })
  const foraDoAr = medidos.filter(v => v.missingSince !== null).length
  if (foraDoAr) notas.push({ tipo: 'fora_do_ar_dentro', n: foraDoAr })
  const naoSabe = medidos.filter(v => v.wasLive === null).length
  if (naoSabe) notas.push({ tipo: 'ao_vivo_nao_se_sabe', n: naoSabe })
  if (medidos.length < RULES.weakBase) return naoMedido('poucos_videos', { n: medidos.length, minimo: RULES.weakBase, notas })
  const valores = medidos.flatMap(v => (v.m1.estado === 'medido' ? [v.m1.valor.views] : []))
  const md = median(valores)
  if (md === null) return naoMedido('poucos_videos', { n: medidos.length, minimo: RULES.weakBase, notas })
  const janela = { de: spDateOf(o.agoraMs - janelaMs), ate: spDateOf(o.agoraMs), dias: MEASURE_RULES.channelWindowDays }
  return medido(md, medidos.length, janela, notas)
}
