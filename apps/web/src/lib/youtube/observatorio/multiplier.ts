// Port of dados.js:743-786 (multiplier adjusted by age)
import { RULES, bandOf } from './rules'
import { median } from './stats'
import { DAY } from './time'
import { viewsAtAge, viewsAtIdx } from './series'
import type { EngineCtx } from './series'
import type { ObsVideo } from './types'

export interface MultiplierResult {
  value: number | null; method: 'mesmo dia de vida' | 'aproximação por faixa' | null; n: number
  base?: number | null; band?: string; bandId?: string; weak: boolean; fallback?: boolean
  dayN?: number | null; fallbackText?: string | null; lifeDay?: number; ageAtRead?: number; readAt?: number
  readNote?: string; label?: string; reason?: string
}

export function multiplierAt(ctx: EngineCtx, v: ObsVideo, t: number | null): MultiplierResult {
  const { clock, fmt } = ctx, SS = ctx.ds.seriesStart
  const ch = ctx.CH.get(v.ch)!
  if (t == null) t = ch.lastIdx
  const own = (v.series.length && t != null) ? viewsAtIdx(v, Math.min(t, v.series[v.series.length - 1]!.idx)) : v.views
  if (own == null) return { value: null, method: null, n: 0, weak: true, reason: v.tracked ? 'sem série' : 'fora dos vídeos acompanhados' }
  const tTime = t != null ? clock.snapTime(t) : v.viewsAt!
  const tt = t
  const totalOf = (u: ObsVideo) => u.series.length ? viewsAtIdx(u, tt!) : u.views
  const others = ch.videos.filter(u => u !== v && u.tracked && u.fmt === v.fmt && u.pub < tTime && (u.series.length ? viewsAtIdx(u, tt!) != null : u.views != null))
  let dayFallbackN: number | null = null
  if (v.pub >= SS && v.series.length) {
    const ageMs = tTime - v.pub, d = Math.floor(ageMs / DAY)
    const base = others.filter(u => u.pub >= SS && u.series.length).map(u => viewsAtAge(ctx, u, ageMs, t)).filter((x): x is number => x != null)
    // A zero median (every comparable video at 0 views) would make own/m Infinity: no base, never ∞×.
    if (base.length >= RULES.weakBase && median(base)! > 0) {
      const m = median(base)!
      return { ageAtRead: Math.floor((tTime - v.pub) / DAY), readAt: tTime, readNote: '', value: own / m, method: 'mesmo dia de vida', lifeDay: d, n: base.length, base: m, weak: false, fallback: false,
        label: fmt.mult(own / m) + ' vs vídeos do canal no mesmo dia de vida (dia ' + d + ', n = ' + base.length + ')' }
    }
    dayFallbackN = base.length
  }
  const age = Math.floor((tTime - v.pub) / DAY), band = bandOf(age)
  const readDiff = bandOf(age) !== bandOf(v.ageDays), readNote = readDiff ? ' no registro de ' + clock.dmhm(tTime) + ' (este tinha ' + fmt.plural(age, 'dia', 'dias') + ')' : ''
  const bb = others.filter(u => bandOf(Math.floor((tTime - u.pub) / DAY)) === band).map(totalOf) as number[]
  const m = median(bb), weak = bb.length < RULES.weakBase
  if (bb.length && !(m! > 0)) return { value: null, method: 'aproximação por faixa', band: band.label, bandId: band.id, n: bb.length, base: m, weak: true, fallback: dayFallbackN != null, dayN: dayFallbackN,
    fallbackText: null, ageAtRead: age, readAt: tTime, readNote, label: 'mediana do canal em 0 views nessa faixa, sem comparação', reason: 'mediana zero' }
  return { value: bb.length ? own / m! : null, method: 'aproximação por faixa', band: band.label, bandId: band.id, n: bb.length, base: m, weak,
    fallback: dayFallbackN != null, dayN: dayFallbackN,
    fallbackText: dayFallbackN != null ? 'método: aproximação por faixa — menos de 3 vídeos do canal com série desde o dia 0' : null,
    ageAtRead: age, readAt: tTime, readNote,
    label: bb.length ? fmt.mult(own / m!) + ' vs vídeos do canal com ' + band.label + (readDiff ? readNote.replace(/\)$/, '; n = ' + bb.length + ')') : ' (n = ' + bb.length + ')') + (weak ? ' — base fraca' : '') : 'sem vídeos do canal nessa faixa' }
}
