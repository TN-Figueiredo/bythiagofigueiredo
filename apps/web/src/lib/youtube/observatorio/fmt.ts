import { DAY, H, MINUS, type Clock } from './time'

/** Port of dados.js:81-105. */
export interface Fmt {
  num(v: number | null): string; subs(v: number | null): string; int(v: number): string; mult(x: number | null): string; pct(x: number | null): string
  pp(x: number | null): string; dec1(x: number): string; plural(n: number, one: string, many: string): string; verVideos(n: number): string
  /** Age by whole days (the bands' age); a video id is resolved through the observatory (dados.js:91). */
  age(v: string | { ageDays?: number | null; pub: number } | null): string; lcfirst(t: string): string
  labelReason(label: string, reason: string, o?: { sentence?: boolean }): string
}

export function createFmt(clock: Clock, videoOf?: (id: string) => { ageDays?: number | null; pub: number } | undefined): Fmt {
  const now = clock.now
  const dec1t = (x: number) => { const r = Math.round(x * 10) / 10; return (r % 1 === 0 ? String(r) : r.toFixed(1)).replace('.', ',').replace('-', MINUS) }
  return {
    num: v => {
      if (v == null) return '—'
      const a = Math.abs(v), s = v < 0 ? MINUS : ''
      if (a < 1000) return s + Math.round(a)
      if (a < 1e6) return s + dec1t(a / 1e3) + ' mil'
      return s + dec1t(a / 1e6) + ' mi'
    },
    subs: v => {
      if (v == null) return '—'
      if (v < 1000) return String(Math.round(v))
      const big = v >= 1e6, x = big ? v / 1e6 : v / 1e3, d = Math.max(0, 2 - Math.floor(Math.log10(x)))
      let t = x.toPrecision(3); t = Number(t).toFixed(d).replace(/\.?0+$/, '')
      return t.replace('.', ',') + (big ? ' mi' : ' mil')
    },
    int: v => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
    mult: x => x == null ? '—' : (Math.round(x * 10) / 10).toFixed(1).replace('.', ',') + '×',
    pct: x => { if (x == null) return '—'; const r = Math.round(x * 100); return (r > 0 ? '+' : r < 0 ? MINUS : '') + Math.abs(r) + '%' },
    pp: x => { if (x == null) return '—'; const r = Math.round(x); return (r > 0 ? '+' : r < 0 ? MINUS : '') + Math.abs(r) + ' pp' },
    dec1: x => (Math.round(x * 10) / 10).toFixed(1).replace('.', ',').replace('-', MINUS),
    plural: (n, one, many) => n + ' ' + (n === 1 ? one : many),
    verVideos: n => n === 1 ? 'Ver o vídeo' : 'Ver os ' + n + ' vídeos',
    age: x => {
      const v = typeof x === 'string' ? (videoOf ? videoOf(x) : undefined) : x
      if (!v) return '—'
      const d = v.ageDays != null ? v.ageDays : Math.floor((now - v.pub) / DAY)
      if (d >= 1) return 'há ' + d + (d === 1 ? ' dia' : ' dias')
      return 'há ' + Math.max(0, Math.floor((now - v.pub) / H)) + ' h'
    },
    lcfirst: t => t ? t.charAt(0).toLowerCase() + t.slice(1) : t,
    labelReason: (label, reason, o) => {
      const r = (reason || '').trim(), low = r.toLowerCase(), l = (label || '').toLowerCase().trim()
      let out: string
      if (!r) out = label
      else if (l && low.startsWith(l + ':')) out = label + ' — ' + r.slice(l.length + 1).trim().replace(/^./, c => c.toLowerCase())
      else if (l && (low === l || low.replace(/[.\s]+$/, '') === l || low.startsWith(l + ' ') || low.startsWith(l + ','))) out = r.charAt(0).toLowerCase() + r.slice(1)
      else if (/ — |: /.test(r)) out = label + '. ' + r.charAt(0).toUpperCase() + r.slice(1)
      else out = label + ' — ' + r.charAt(0).toLowerCase() + r.slice(1)
      return o && o.sentence ? out.charAt(0).toUpperCase() + out.slice(1) : out
    },
  }
}
