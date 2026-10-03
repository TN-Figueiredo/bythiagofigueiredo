/** Port of dados.js:20-79 — NOW/SERIES_START/SNAP0 are parameters. All instants are epoch ms; display in America/Sao_Paulo. */
export const DAY = 864e5, H = 36e5, MINUS = '−'
const SP_OFF = 3 * H // America/Sao_Paulo is UTC−3, no DST since 2019
export const WD = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const WDS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const p2 = (n: number) => (n < 10 ? '0' : '') + n

/** Largest whole São Paulo hour <= ms (SP offset is a whole number of hours, so UTC flooring is equivalent). */
export const floorHour = (ms: number) => Math.floor(ms / H) * H
/** Smallest whole hour >= ms. */
export const ceilHour = (ms: number) => Math.ceil(ms / H) * H
/** 00:00 in São Paulo of the SP calendar day that contains `ms`. */
export const spDayStart = (ms: number) => Math.floor((ms - SP_OFF) / DAY) * DAY + SP_OFF
/** 00:00 in São Paulo of a calendar date 'YYYY-MM-DD' (a DB `date` column, already an SP day). */
export const spDateStart = (date: string) => Date.parse(date.slice(0, 10) + 'T00:00:00Z') + SP_OFF

export interface Clock {
  now: number; seriesStart: number; snap0: number
  snapTime(i: number): number; snapIdxAtOrAfter(t: number): number; snapIdxAtOrBefore(t: number): number
  parts(ms: number): { y: number; mo: number; d: number; h: number; mi: number; dow: number }
  dm(ms: number): string; dmy(ms: number): string; dmOrDmy(ms: number): string; hm(ms: number): string; hh(ms: number): string; dmhm(ms: number): string
  weekday(ms: number): string; weekdayShort(ms: number): string; ago(ms: number): string; agoHours(ms: number): string; daysAgo(ms: number): number
  windowText(a: number, b: number): string; dur(ms: number, approx?: boolean): string; spIso(s: string): number
  sp(y: number, mo: number, d: number, h?: number, mi?: number): number
}

export function createClock(now: number, seriesStart: number, snap0: number): Clock {
  const sp = (y: number, mo: number, d: number, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h, mi) + SP_OFF
  const parts = (ms: number) => { const d = new Date(ms - SP_OFF); return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), dow: d.getUTCDay() } }
  const dm = (ms: number) => { const p = parts(ms); return p2(p.d) + '/' + p2(p.mo) }
  const hm = (ms: number) => { const p = parts(ms); return p2(p.h) + ':' + p2(p.mi) }
  const thisYear = parts(now).y
  return {
    now, seriesStart, snap0, sp, parts,
    spIso: s => { const a = s.split(/[-T:]/).map(Number); return sp(a[0]!, a[1]!, a[2]!, a[3] || 0, a[4] || 0) },
    snapTime: i => snap0 + i * DAY,
    snapIdxAtOrAfter: t => Math.ceil((t - snap0) / DAY - 1e-9),
    snapIdxAtOrBefore: t => Math.floor((t - snap0) / DAY + 1e-9),
    dm, hm,
    dmy: ms => { const p = parts(ms); return p2(p.d) + '/' + p2(p.mo) + '/' + p.y },
    dmOrDmy: ms => { const p = parts(ms); return p2(p.d) + '/' + p2(p.mo) + (p.y !== thisYear ? '/' + p.y : '') },
    hh: ms => p2(parts(ms).h) + 'h',
    dmhm: ms => dm(ms) + ' ' + hm(ms),
    weekday: ms => WD[parts(ms).dow]!,
    weekdayShort: ms => WDS[parts(ms).dow]!,
    ago: ms => {
      const d = now - ms
      if (d < 0) return 'no futuro'
      if (d < 6e4) return 'agora'
      if (d < H) return 'há ' + Math.max(1, Math.round(d / 6e4)) + ' min'
      if (d < 48 * H) return 'há ' + Math.round(d / H) + ' h'
      const n = Math.round(d / DAY); return 'há ' + n + (n === 1 ? ' dia' : ' dias')
    },
    agoHours: ms => 'há ' + Math.round((now - ms) / H) + ' h',
    daysAgo: ms => Math.floor((now - ms) / DAY),
    windowText: (a, b) => {
      const pa = parts(a), pb = parts(b), same = pa.d === pb.d && pa.mo === pb.mo
      return 'entre ' + dm(a) + ' ' + p2(pa.h) + 'h e ' + (same ? '' : dm(b) + ' ') + p2(pb.h) + 'h'
    },
    dur: (ms, approx) => {
      if (approx) { const d = Math.round(ms / DAY); return d >= 1 ? '≈ ' + d + ' d' : '≈ ' + Math.round(ms / H) + ' h' }
      const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / H), mi = Math.round((ms % H) / 6e4)
      return d ? d + ' d ' + h + ' h' : h ? h + ' h ' + mi + ' min' : mi + ' min'
    },
  }
}
