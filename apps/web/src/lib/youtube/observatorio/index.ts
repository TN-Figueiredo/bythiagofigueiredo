import type { Dataset, ObsChannel, ObsVideo } from './types'
export type { Dataset } from './types'

export interface Observatory {
  NOW: number; SERIES_START: number; DAY: number; H: number
  channels: ObsChannel[]; videos: ObsVideo[]
  channel(id: string): ObsChannel | undefined; video(id: string): ObsVideo | undefined
  TAB_COUNTS: Record<string, { canais: number; mud: number; out: number }>
  changes: unknown[]; forja: { readings: unknown[] }
}
export function createObservatory(ds: Dataset, _opts?: { seriesStartLabel?: string }): Observatory {
  const CH = new Map(ds.channels.map(c => [c.id, c])), V = new Map(ds.videos.map(v => [v.id, v]))
  return {
    NOW: ds.now, SERIES_START: ds.seriesStart, DAY: 864e5, H: 36e5,
    channels: ds.channels, videos: ds.videos, channel: id => CH.get(id), video: id => V.get(id),
    TAB_COUNTS: { todos: { canais: 14, mud: 18, out: 11 }, viagem: { canais: 8, mud: 8, out: 5 }, ia: { canais: 6, mud: 10, out: 6 } },
    changes: [], forja: { readings: ds.readings },
  }
}
