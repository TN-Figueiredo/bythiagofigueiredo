import type { Dataset, ObsChannel, ObsVideo } from './types'
export type { Dataset } from './types'
import { createClock, type Clock } from './time'
import { createFmt, type Fmt } from './fmt'
import { RULES, AGE_BANDS, OUT_WINDOWS, DEFAULT_AGES, NICHES, bandOf, winOf, tierOf } from './rules'
import { median, quant } from './stats'
import { viewsAtIdx, rate, vpdSince, vpd7, periodRate, expectedCurve, type EngineCtx, type Derived, type PeriodRate, type ExpectedCurve } from './series'
import { diffLines, titleDiff } from './text-diff'
import { deriveChanges, changesIn, caveats, REWRITE_GROUPS, type ObsChange } from './changes'

export interface Observatory {
  NOW: number; SERIES_START: number; DAY: number; H: number
  channels: ObsChannel[]; videos: (ObsVideo & Derived)[]
  channel(id: string): ObsChannel | undefined; video(id: string): (ObsVideo & Derived) | undefined
  seriesOf(id: string): ObsVideo['series']; viewsAt(id: string, idx: number): number | null; rate(id: string, a: number, b: number): number | null
  periodRate(id: string, fromMs: number, toMs: number): PeriodRate; expectedCurve(id: string): ExpectedCurve
  diffLines: typeof diffLines; titleDiff: typeof titleDiff; rewriteGroups: { id: string; label: string }[]
  change(id: string): ObsChange | undefined; changesIn(o?: Parameters<typeof changesIn>[1]): ObsChange[]; caveats(id: string): string[]
  TAB_COUNTS: Record<string, { canais: number; mud: number; out: number }>
  changes: ObsChange[]; forja: { readings: unknown[] }
  RULES: typeof RULES; AGE_BANDS: typeof AGE_BANDS; OUT_WINDOWS: typeof OUT_WINDOWS; DEFAULT_AGES: typeof DEFAULT_AGES; NICHES: typeof NICHES
  date: Clock; fmt: Fmt; median: typeof median; quant: typeof quant; bandOf: typeof bandOf; winOf: typeof winOf; tierOf: typeof tierOf
  SYNC: { last: number; next: number | null; text: string; title: string; nextText: string | null }
  LAST_IDX: number; TZ: string; TZ_LABEL: string; SERIES_START_LABEL: string
}
export function createObservatory(ds: Dataset, _opts?: { seriesStartLabel?: string }): Observatory {
  const clock = createClock(ds.now, ds.seriesStart, ds.snap0), fmt = createFmt(clock)
  let maxT = -Infinity
  for (const v of ds.videos) for (const p of v.series) if (p.t > maxT) maxT = p.t
  const last = ds.sync.last, next = ds.sync.next
  // Derived values live on copies: the input dataset is never mutated.
  const videos: (ObsVideo & Derived)[] = ds.videos.map(v => ({ ...v, vpd: null, vpd7: null, mult: null }))
  const V = new Map(videos.map(v => [v.id, v]))
  const CH = new Map(ds.channels.map(c => [c.id, { ...c, videos: videos.filter(v => v.ch === c.id).sort((a, b) => b.pub - a.pub) }]))
  const ctx: EngineCtx = { ds: { ...ds, videos }, clock, fmt, CH, V, CHG: new Map() }
  for (const v of videos) { v.vpd = vpdSince(ctx, v); v.vpd7 = vpd7(ctx, v) }
  const changes = deriveChanges(ctx)
  const vid = (id: string) => { const v = V.get(id); if (!v) throw new Error('unknown video ' + id); return v }
  return {
    NOW: ds.now, SERIES_START: ds.seriesStart, DAY: 864e5, H: 36e5,
    channels: ds.channels, videos, channel: id => CH.get(id), video: id => V.get(id),
    seriesOf: id => vid(id).series, viewsAt: (id, idx) => viewsAtIdx(vid(id), idx), rate: (id, a, b) => rate(ctx, vid(id), a, b),
    periodRate: (id, f, t) => periodRate(ctx, id, f, t), expectedCurve: id => expectedCurve(ctx, id),
    diffLines, titleDiff, rewriteGroups: REWRITE_GROUPS.map(g => ({ id: g.id, label: g.label })),
    change: id => ctx.CHG.get(id), changesIn: o => changesIn(ctx, o), caveats: id => caveats(ctx, id),
    // STUB — replaced when 'contagens das abas' is ported (Task 16)
    TAB_COUNTS: { todos: { canais: 14, mud: 18, out: 11 }, viagem: { canais: 8, mud: 8, out: 5 }, ia: { canais: 6, mud: 10, out: 6 } },
    RULES, AGE_BANDS, OUT_WINDOWS, DEFAULT_AGES, NICHES, date: clock, fmt, median, quant, bandOf, winOf, tierOf,
    SYNC: { last, next, text: 'sincronizado ' + clock.ago(last), title: clock.dm(last) + ' ' + clock.hm(last) + ' (SP)', nextText: next ? 'próxima às ' + clock.hm(next) : null },
    LAST_IDX: clock.snapIdxAtOrBefore(maxT), TZ: 'America/Sao_Paulo', TZ_LABEL: 'Horários em São Paulo', SERIES_START_LABEL: clock.dm(ds.seriesStart),
    changes, forja: { readings: ds.readings },
  }
}
