import type { Dataset, ObsChannel, ObsVideo } from './types'
export type { Dataset } from './types'
import { createClock, type Clock } from './time'
import { createFmt, type Fmt } from './fmt'
import { RULES, AGE_BANDS, OUT_WINDOWS, DEFAULT_AGES, NICHES, bandOf, winOf, tierOf } from './rules'
import { median, quant } from './stats'

export interface Observatory {
  NOW: number; SERIES_START: number; DAY: number; H: number
  channels: ObsChannel[]; videos: ObsVideo[]
  channel(id: string): ObsChannel | undefined; video(id: string): ObsVideo | undefined
  TAB_COUNTS: Record<string, { canais: number; mud: number; out: number }>
  changes: unknown[]; forja: { readings: unknown[] }
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
  const CH = new Map(ds.channels.map(c => [c.id, c])), V = new Map(ds.videos.map(v => [v.id, v]))
  return {
    NOW: ds.now, SERIES_START: ds.seriesStart, DAY: 864e5, H: 36e5,
    channels: ds.channels, videos: ds.videos, channel: id => CH.get(id), video: id => V.get(id),
    TAB_COUNTS: { todos: { canais: 14, mud: 18, out: 11 }, viagem: { canais: 8, mud: 8, out: 5 }, ia: { canais: 6, mud: 10, out: 6 } },
    RULES, AGE_BANDS, OUT_WINDOWS, DEFAULT_AGES, NICHES, date: clock, fmt, median, quant, bandOf, winOf, tierOf,
    SYNC: { last, next, text: 'sincronizado ' + clock.ago(last), title: clock.dm(last) + ' ' + clock.hm(last) + ' (SP)', nextText: next ? 'próxima às ' + clock.hm(next) : null },
    LAST_IDX: clock.snapIdxAtOrBefore(maxT), TZ: 'America/Sao_Paulo', TZ_LABEL: 'Horários em São Paulo', SERIES_START_LABEL: clock.dm(ds.seriesStart),
    changes: [], forja: { readings: ds.readings },
  }
}
