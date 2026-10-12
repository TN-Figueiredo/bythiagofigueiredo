import type { Dataset, NicheDef, ObsChannel, ObsVideo, SeriesPoint } from './types'
import type { ObsChange } from './changes'
import type { Clock } from './time'
import type { Fmt } from './fmt'
import type { MultiplierResult } from './multiplier'
import { DAY, H } from './time'
import { RULES, bandOf } from './rules'
import { median } from './stats'
import { isObserved } from './observed'

export interface Derived { vpd: number | null; vpd7: number | null; mult: MultiplierResult | null }
export interface EngineCtx {
  ds: Dataset; clock: Clock; fmt: Fmt
  CH: Map<string, ObsChannel & { videos: ObsVideo[] }>
  V: Map<string, ObsVideo & Derived>
  CHG: Map<string, ObsChange>
  /** Os nichos do site, na ordem das abas (os de fábrica quando o dataset não traz lista). */
  niches: readonly NicheDef[]
}

/**
 * For the functions that aggregate ACROSS the site's channels: on the dataset of one channel (scope 'canal') they would
 * answer with that channel alone and no error, so they refuse it. Takes the context's `ds` only.
 */
export function assertSiteScope(ctx: { ds: Pick<Dataset, 'scope'> }, what: string): void {
  if (ctx.ds.scope === 'canal') throw new Error(what + " aggregates across the site's channels, and this dataset holds only one (loadChannelDataset): its answer would be that channel's alone, with no error. Read the whole site (loadPageDataset) for it.")
}

/** Per-video idx → point index, built once. The mockup's `series[i - firstIdx]` assumes a contiguous series; this does not. */
const POINTS = new WeakMap<readonly SeriesPoint[], Map<number, SeriesPoint>>()
function pointsOf(v: ObsVideo): Map<number, SeriesPoint> {
  let m = POINTS.get(v.series)
  if (!m) { m = new Map(v.series.map(p => [p.idx, p])); POINTS.set(v.series, m) }
  return m
}
const lastIdxOf = (v: ObsVideo) => v.series[v.series.length - 1]!.idx
/** Real daily point, no virtual publication point (dados.js:587 `S`). */
export function viewsAtIdx(v: ObsVideo, i: number): number | null {
  if (!v.series.length) return null
  const p = pointsOf(v).get(i)
  return p ? p.views : null
}
const virtual = (ctx: EngineCtx, v: ObsVideo, i: number) => v.firstIdx != null && i === v.firstIdx - 1 && fromDayZero(ctx, v)
/** Virtual publication point → pub; real record → its real read instant (`t`), nominal 12:00 only when the point is absent. */
export function pointTime(ctx: EngineCtx, v: ObsVideo, i: number): number { return virtual(ctx, v, i) ? v.pub : pointsOf(v).get(i)?.t ?? ctx.clock.snapTime(i) }
/** views/day over an elapsed time; null (never negative, never Infinity) when the elapsed time is ≤ 0 — no base, no rate.
 *  No larger minimum: the mockup oracle (dados.js) rates a video read minutes after its publication, and parity is tested. */
const ratePerDay = (dv: number, dt: number): number | null => (dt > 0 ? dv / (dt / DAY) : null)
export function pointViews(ctx: EngineCtx, v: ObsVideo, i: number): number | null { return virtual(ctx, v, i) ? 0 : viewsAtIdx(v, i) }
/** Published inside the series AND with the whole series read (not cut by the lookback cap): a day-0 baseline exists. */
export const fromDayZero = (ctx: EngineCtx, v: ObsVideo): boolean => v.pub >= ctx.ds.seriesStart && !v.truncated
/** f−1 = virtual publication point (0 views) for videos published inside the series. */
export function earliestIdx(v: ObsVideo, seriesStart: number): number { return v.pub >= seriesStart && !v.truncated ? v.firstIdx! - 1 : v.firstIdx! }
export function rate(ctx: EngineCtx, v: ObsVideo, a: number, b: number): number | null {
  const va = pointViews(ctx, v, a), vb = pointViews(ctx, v, b)
  if (va == null || vb == null) return null
  return ratePerDay(vb - va, pointTime(ctx, v, b) - pointTime(ctx, v, a))
}
export function vpdSince(ctx: EngineCtx, v: ObsVideo): number | null {
  if (!v.series.length) return null
  const a = earliestIdx(v, ctx.ds.seriesStart), b = lastIdxOf(v)
  if (b - a < 1) return null
  return rate(ctx, v, a, b)
}
export function vpd7(ctx: EngineCtx, v: ObsVideo): number | null {
  if (!v.series.length) return null
  const b = lastIdxOf(v), a = b - 7
  if (a < earliestIdx(v, ctx.ds.seriesStart)) return null
  return rate(ctx, v, a, b)
}
export const changedSince = (ctx: EngineCtx, v: ObsVideo): boolean =>
  [v.titles, v.thumbs, v.descs].some(arr => (arr as { first_seen: number }[]).some((x, j) => j > 0 && x.first_seen >= ctx.ds.seriesStart))

/** Views of `u` at age `ageMs`, if the series covers it (up to record `tMax`). */
export function viewsAtAge(ctx: EngineCtx, u: ObsVideo, ageMs: number, tMax: number | null): number | null {
  if (!u.series.length) return null
  const T = u.pub + ageMs, lastI = Math.min(lastIdxOf(u), tMax == null ? 1e9 : tMax)
  if (T > pointTime(ctx, u, lastI) + 1) return null
  let a = earliestIdx(u, ctx.ds.seriesStart)
  for (let i = a; i <= lastI; i++) { if (pointTime(ctx, u, i) <= T) a = i; else break }
  const va = pointViews(ctx, u, a)
  if (pointTime(ctx, u, a) === T || a === lastI) return va
  const b = a + 1, ta = pointTime(ctx, u, a), tb = pointTime(ctx, u, b), vb = pointViews(ctx, u, b)
  if (va == null || vb == null) return null
  return va + (vb - va) * (T - ta) / (tb - ta)
}

export type IntervalKind = 'diario' | 'semanal'
export interface Interval { a: number; b: number; vpd: number; idxTo: number; kind: IntervalKind }

/** Todos os dias de `from` a `to` (índices de dia, inclusive) estavam em faixa semanal? Dia sem faixa gravada: não. */
export function weeklyThroughout(v: Pick<ObsVideo, 'tierSpans'>, from: number, to: number): boolean {
  const spans = v.tierSpans ?? []
  if (!spans.length || from > to) return false
  for (let d = from; d <= to; d++) {
    const s = spans.find(x => x.from <= d && (x.to == null || x.to >= d))
    if (!s || s.tier !== 'semanal') return false
  }
  return true
}

/**
 * Os intervalos entre pontos seguidos. Sem `weekly` é exatamente o de sempre: só dias vizinhos; um dia sem ponto é
 * buraco. Com `weekly`, um salto de 2 a 8 dias de calendário vale como "taxa média da semana" SE todos os dias sem
 * leitura estavam em faixa semanal (a faixa gravada no tempo, não a distância: um cron parado por 3 dias num vídeo
 * diário continua sendo buraco). Vídeo sem faixa gravada nunca tem intervalo semanal.
 */
export function intervalsOf(ctx: EngineCtx, v: ObsVideo, opts: { weekly?: boolean } = {}): Interval[] {
  if (!v.series.length) return []
  const out: Interval[] = [], a0 = earliestIdx(v, ctx.ds.seriesStart), last = lastIdxOf(v)
  for (let i = a0; i < last; i++) {
    const ya = pointViews(ctx, v, i)
    if (ya == null) continue
    const yb = pointViews(ctx, v, i + 1)
    if (yb != null) {
      const ta = pointTime(ctx, v, i), tb = pointTime(ctx, v, i + 1)
      const r = ratePerDay(yb - ya, tb - ta)
      if (r == null) continue // too short (or non-positive) an interval: no average rather than a wild or negative one
      out.push({ a: ta, b: tb, vpd: r, idxTo: i + 1, kind: 'diario' })
      continue
    }
    if (!opts.weekly) continue // a hole: no interval across a missing day
    const max = Math.min(last, i + RULES.series.weeklyMaxGapDays)
    let j = i + 2
    while (j <= max && viewsAtIdx(v, j) == null) j++
    if (j > max) continue                            // nenhum ponto em até 8 dias: buraco
    if (!weeklyThroughout(v, i + 1, j - 1)) continue  // os dias sem leitura não estavam em faixa semanal: buraco
    const ta = pointTime(ctx, v, i), tb = pointTime(ctx, v, j)
    const r = ratePerDay(viewsAtIdx(v, j)! - ya, tb - ta)
    if (r == null) continue
    out.push({ a: ta, b: tb, vpd: r, idxTo: j, kind: 'semanal' })
  }
  return out
}

/** A série que se lê de um vídeo: a dele; ou, se não é observado, os pontos guardados à parte. */
const withUnobserved = <T extends ObsVideo>(v: T): T =>
  v.series.length || !v.unobservedSeries?.length ? v : { ...v, series: v.unobservedSeries, firstIdx: v.unobservedSeries[0]!.idx }

export interface WeeklyRate extends PeriodRate { weekly: boolean }
/**
 * Como periodRate, aceitando intervalo semanal e a série de um vídeo não observado. `weekly` = pelo menos um intervalo
 * semanal entrou na conta, e então o número é a TAXA MÉDIA DA SEMANA (a frase diz). NENHUMA tela chama isto ainda (E5).
 */
export function weeklyRate(ctx: EngineCtx, videoId: string, fromMs: number, toMs: number): WeeklyRate {
  const stored = ctx.V.get(videoId)
  if (!stored) throw new Error('weeklyRate: unknown video ' + videoId)
  const none = (text: string): WeeklyRate => ({ vpd: null, sharedDay: false, onlySinceDays: null, coveredHours: 0, text, weekly: false })
  if (toMs - fromMs < DAY) return none('menos de 1 dia no ar, sem média')
  const iv = intervalsOf(ctx, withUnobserved(stored), { weekly: true })
  let s = 0, w = 0, weekly = false
  for (const x of iv) { const o = Math.min(toMs, x.b) - Math.max(fromMs, x.a); if (o > 0) { s += x.vpd * o; w += o; if (x.kind === 'semanal') weekly = true } }
  if (w < DAY) return none('sem registro no período')
  const vpd = s / w
  return { vpd, sharedDay: false, onlySinceDays: null, coveredHours: w / H, weekly, text: '≈ ' + ctx.fmt.num(vpd) + (weekly ? ' (taxa média da semana)' : '') }
}

export interface PeriodRate { vpd: number | null; sharedDay: boolean; onlySinceDays: number | null; coveredHours: number; text: string }
export function periodRate(ctx: EngineCtx, videoId: string, fromMs: number, toMs: number): PeriodRate {
  const v = ctx.V.get(videoId)
  if (!v) throw new Error('periodRate: unknown video ' + videoId)
  if (toMs - fromMs < DAY) return { vpd: null, sharedDay: false, onlySinceDays: null, coveredHours: 0, text: 'menos de 1 dia no ar, sem média' }
  const iv = intervalsOf(ctx, v)
  if (!iv.length) return { vpd: null, sharedDay: false, onlySinceDays: null, coveredHours: 0, text: isObserved(v) ? 'aguardando o 2º registro diário' : 'fora dos vídeos acompanhados' }
  let s = 0, w = 0, shared = false
  for (const x of iv) { const o = Math.min(toMs, x.b) - Math.max(fromMs, x.a); if (o > 0) { s += x.vpd * o; w += o; if (o < x.b - x.a - 1) shared = true } }
  if (w < DAY) return { vpd: null, sharedDay: shared, onlySinceDays: null, coveredHours: w / H, text: 'sem registro diário no período' }
  const vpd = s / w, coveredDays = Math.round(w / DAY)
  const onlySince = fromMs < iv[0]!.a ? coveredDays : null
  return { vpd, sharedDay: shared, onlySinceDays: onlySince, coveredHours: w / H,
    text: '≈ ' + ctx.fmt.num(vpd) + (onlySince ? ' (só desde ' + ctx.clock.dm(ctx.ds.seriesStart) + ', ' + onlySince + ' dias)' : shared ? ' (inclui dia compartilhado)' : '') }
}

export interface CurvePoint { idx: number; t: number; from: number; lifeDay: number; ageDaysFrom: number; vpd: number | null; n: number; vpdAnchored: number | null; nAnchored: number; observed: number | null }
export type ExpectedCurve = CurvePoint[] & { method: string; methodLabel: string; band: string | null }
const newCurve = (method: string, band: string | null): ExpectedCurve => Object.assign([] as CurvePoint[], { method, methodLabel: method ? 'método: ' + method : '', band })

/** Median of the channel's other videos at the same life day. */
export function expectedCurve(ctx: EngineCtx, videoId: string): ExpectedCurve {
  const v = ctx.V.get(videoId)
  if (!v || !v.series.length) return newCurve('', null)
  const ch = ctx.CH.get(v.ch)!, SS = ctx.ds.seriesStart, SNAP0 = ctx.ds.snap0
  const others = ch.videos.filter(u => u !== v && u.tracked && u.fmt === v.fmt && u.series.length && !changedSince(ctx, u))
  const iv = intervalsOf(ctx, v)
  if (!iv.length) return newCurve('', null)
  const rateAtAge = (u: ObsVideo, a0: number, a1: number) => {
    const x0 = viewsAtAge(ctx, u, a0, ch.lastIdx), x1 = viewsAtAge(ctx, u, a1, ch.lastIdx)
    return x0 == null || x1 == null ? null : (x1 - x0) / ((a1 - a0) / DAY)
  }
  const first = iv[0]!, firstA0 = first.a - v.pub, firstA1 = first.b - v.pub, firstOwn = first.vpd
  const inSeries = fromDayZero(ctx, v)
  const out = newCurve(inSeries ? 'mesmo dia de vida' : 'aproximação por faixa', inSeries ? null : bandOf(v.ageDays).label)
  iv.forEach(x => {
    const a0 = x.a - v.pub, a1 = x.b - v.pub
    const raw: number[] = [], rel: number[] = []
    for (const u of others) {
      if (u.pub + a0 < (fromDayZero(ctx, u) ? u.pub : SNAP0)) continue
      const r = rateAtAge(u, a0, a1); if (r == null) continue
      raw.push(r)
      const r0 = rateAtAge(u, firstA0, firstA1)
      if (r0 != null && r0 > 0 && u.pub + firstA0 >= (fromDayZero(ctx, u) ? u.pub : SNAP0)) rel.push(r / r0)
    }
    const vpd = raw.length >= RULES.weakBase ? median(raw) : null
    const anch = rel.length >= RULES.weakBase ? median(rel)! * firstOwn : null
    if (vpd == null && anch == null) return
    out.push({ idx: x.idxTo, t: x.b, from: x.a, lifeDay: inSeries ? x.idxTo - v.firstIdx! : Math.floor(a0 / DAY), ageDaysFrom: a0 / DAY, vpd, n: raw.length, vpdAnchored: anch, nAnchored: rel.length, observed: x.vpd })
  })
  return out
}
