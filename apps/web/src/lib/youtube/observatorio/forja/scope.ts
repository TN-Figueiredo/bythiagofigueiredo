// Port of dados.js:992-996 + 1219 + 1274-1275 (reading types), 1369 (OUTLIER_READING_TYPES), 1423-1432 (eligibleChannels),
// 1876-1896 (readingScope, timing, timingText), 1907-1908 (readingTypeFor, shortsNote).
import { RULES, OUT_WINDOWS } from '../rules'
import { median } from '../stats'
import { BUILTIN_NICHES, forjaOrder, inNiche, type NicheScope } from '../niche'
import { NEVER_SYNCED } from '../channels'
import { assertSiteScope, type EngineCtx } from '../series'
import type { Fmt, ForjaRequest, FrozenReading, Niche } from '../types'

/** The engine context the forja needs on top of the observatory's: the frozen readings by id and the last daily record. */
export interface ForjaCtx extends EngineCtx { READ: Record<string, FrozenReading>; lastIdx: number }

export interface ReadingType { id: string; label: string; windowDays: number | null; fmt?: Fmt | null; aka?: string; target?: 'video'; shorts: boolean }
/** The reading types, verbatim (order as the mockup builds them). */
export const READING_TYPES: ReadonlyArray<ReadingType> = [
  { id: 'padroes-titulo', label: 'Padrões de título dos outliers (6 meses)', windowDays: 182, fmt: 'long', shorts: false },
  { id: 'temas', label: 'Temas dos outliers (90 dias)', aka: 'Temas emergentes', windowDays: 90, fmt: 'long', shorts: false },
  { id: 'resumo-trocas', label: 'Resumo das trocas (30 dias)', windowDays: 30, shorts: false },
  { id: 'leitura-video', label: 'Leitura do vídeo', target: 'video', windowDays: null, fmt: null, shorts: false },
  { id: 'padroes-titulo-shorts', label: 'Padrões de título dos outliers — Shorts (6 meses)', windowDays: 182, fmt: 'short', shorts: true },
]
/** Readings about outliers: the only ones with a reading scope. */
export const OUTLIER_READING_TYPES: readonly string[] = ['padroes-titulo', 'padroes-titulo-shorts', 'temas']
export const readingTypeFor = (fmtId: Fmt | null | undefined): string => fmtId === 'short' ? 'padroes-titulo-shorts' : 'padroes-titulo'
export const SHORTS_NOTE = 'A forja lê Shorts: “Padrões de título dos outliers — Shorts (6 meses)”, leituras separadas das de vídeos longos.'

export interface Eligible { in: string[]; out: Array<{ id: string; reason: string }> }
/**
 * Channels in / out of a niche's request: a channel still fetching videos, or with no sync for more than
 * RULES.staleSyncHours, or never synced successfully, stays out with the reason ("<Canal> fica fora: sem sincronização há 3 dias",
 * "<Canal> fica fora: nunca sincronizado com sucesso").
 */
export function eligibleChannels(ctx: EngineCtx, niche: NicheScope | Niche | 'all' | null | undefined): Eligible {
  // a niche's channels are the SITE's: on one channel's set the list would hold that channel alone (or nobody), with no error
  assertSiteScope(ctx, 'eligibleChannels')
  const { clock } = ctx
  const inn: string[] = [], out: Array<{ id: string; reason: string }> = []
  for (const c of ctx.CH.values()) {
    if (c.own || !inNiche(niche, c)) continue
    const last = c.sync.last, age = last == null ? Infinity : (clock.now - last) / 36e5
    if (c.sync.state === 'backfill') out.push({ id: c.id, reason: c.name + ' fica fora: ainda buscando vídeos (' + (c.sync.backfill ? c.sync.backfill.done + ' de ' + c.sync.backfill.total : '') + ')' })
    else if (last == null) out.push({ id: c.id, reason: c.name + ' fica fora: ' + NEVER_SYNCED })   // Task 20b: no good sync ever
    else if (age > RULES.staleSyncHours) out.push({ id: c.id, reason: c.name + ' fica fora: sem sincronização ' + (age < 48 ? clock.agoHours(last) : clock.ago(last)) })
    else inn.push(c.id)
  }
  return { in: inn, out }
}

export interface ReadingScope {
  readingId: string; type: string; niche: Niche | null; fmt: Fmt | null; channels: string[]; windowDays: number | null; ages: string[] | null
  maxAge?: number; asof: string; asOf: number; nThen: number | null; text?: string
}
export interface ScopeFilter { formula?: string | null; theme?: string | null; min?: number | null; channel?: string | null }
const SP_OFF = 3 * 36e5 // America/Sao_Paulo is UTC−3, no DST since 2019
const spDate = (ms: number) => new Date(ms - SP_OFF).toISOString().slice(0, 10)

/** Scope of an outliers reading for evidence links (Outliers applies it with reading=<id>); null for other readings. */
export function readingScope(ctx: EngineCtx & { READ: Record<string, FrozenReading> }, id: string, filt?: ScopeFilter | null): ReadingScope | null {
  const r = Object.prototype.hasOwnProperty.call(ctx.READ, id) ? ctx.READ[id] : undefined
  if (!r || !r.base || !r.base.videos || !OUTLIER_READING_TYPES.includes(r.type)) return null
  const { clock, fmt } = ctx, base = r.base
  const w = base.windowDays, fmtId: Fmt = r.fmt || base.fmt || 'long'
  if (w == null) return { readingId: id, type: r.type, niche: r.niche, fmt: null, channels: base.channels, windowDays: null, ages: null, asof: spDate(r.generatedAt), asOf: r.sent.asOf, nThen: null }
  const ages = OUT_WINDOWS.filter(x => x.lo <= w).map(x => x.id)
  const chs = base.channels.filter(c => base.videos.some(v => v.ch === c))
  let nThen: number | null = r.analysis && r.analysis.nOutliers != null ? r.analysis.nOutliers : null
  if (filt && (filt.formula || filt.theme || filt.min != null || filt.channel)) {
    const mn = filt.min != null ? filt.min : RULES.outlierMin
    nThen = base.videos.filter(v => !v.weak && v.mult >= mn && (!filt.formula || v.formulas.includes(filt.formula)) && (!filt.theme || v.theme === filt.theme) && (!filt.channel || v.ch === filt.channel)).length
  }
  return { readingId: id, type: r.type, niche: r.niche, fmt: fmtId, channels: chs, windowDays: w, ages, maxAge: w,
    asof: spDate(r.generatedAt), asOf: r.sent.asOf, nThen,
    text: 'A leitura de ' + clock.dm(r.generatedAt) + ' (' + (w >= 180 ? '6 meses' : w + ' dias') + ', ' + fmt.plural(chs.length, 'canal', 'canais') + ') via ' + nThen }
}

export interface Timing { type: string; niche: NicheScope; n: number; medianMinutes: number | null; text: string }
const NOT_MEASURED_NONE = 'tempo deste tipo ainda não medido (nenhuma leitura ainda; mediana a partir de 5)'
/**
 * How long this type of reading takes, from the published requests (scenario requests never count).
 * The median only from 5 readings on: "tempo deste tipo ainda não medido (2 leituras; mediana a partir de 5)".
 */
export function timing(requests: readonly ForjaRequest[], type: string, niche?: NicheScope | Niche | null, o?: { count?: number } | null): Timing {
  const nn: NicheScope = niche || 'todos'
  if (o && o.count === 0) return { type, niche: nn, n: 0, medianMinutes: null, text: NOT_MEASURED_NONE }
  const rs = requests.filter(q => !q.scenario && q.type === type && (!niche || niche === 'todos' || q.niche === niche) && q.state === 'publicado' && q.publishedAt != null)
  const mins = rs.map(q => (q.publishedAt! - q.createdAt) / 6e4), n = rs.length
  const med = n >= 5 ? median(mins) : null
  return { type, niche: nn, n, medianMinutes: med,
    text: med != null ? 'mediana das últimas ' + n + ': ' + Math.round(med) + ' min' : n === 0 ? NOT_MEASURED_NONE : 'tempo deste tipo ainda não medido (' + n + ' ' + (n === 1 ? 'leitura' : 'leituras') + '; mediana a partir de 5)' }
}

export type ReadingTypeWithTiming = ReadingType & { timingByNiche: Record<Niche, string>; timingText: string }
/**
 * READING_TYPES with each type's timing text (dados.js:1896). `order` = the niches in the forja's order (IA, Viagem, then
 * the owner's); the type's text is the one of the niche with the fewest readings (the first of the order on a tie).
 */
export function readingTypes(requests: readonly ForjaRequest[], order: readonly Niche[] = forjaOrder(BUILTIN_NICHES)): ReadingTypeWithTiming[] {
  return READING_TYPES.map(t => {
    const per = order.map(n => ({ n, t: timing(requests, t.id, n) }))
    const timingByNiche: Record<Niche, string> = Object.fromEntries(per.map(x => [x.n, x.t.text]))
    const least = per.reduce<Timing | null>((best, x) => (best == null || x.t.n < best.n ? x.t : best), null)
    return { ...t, timingByNiche, timingText: t.id === 'leitura-video' || !least ? timing(requests, t.id, 'todos').text : least.text }
  })
}

/** The most recent frozen reading of a type and niche. */
export function latest(readings: readonly FrozenReading[], type: string, niche: Niche): FrozenReading | null {
  return readings.filter(r => r.type === type && r.niche === niche).sort((a, b) => b.generatedAt - a.generatedAt)[0] || null
}
