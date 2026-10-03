export type Niche = 'viagem' | 'ia'
export type { NicheScope } from './niche' // single definition (Task 11)
export type Fmt = 'long' | 'short'
export type Precision = 'min' | '6h' | '1d'
export type SyncState = 'ok' | 'atrasado' | 'erro' | 'backfill'

export interface SeriesPoint { idx: number; t: number; views: number }
interface VersionBase { id: string; first_seen: number; last_seen: number; current: boolean; prec: Precision | 'first' | null; window: [number, number] | null; F?: number }
export interface ThumbArt { text: string; bg: string; fg: string; face: string; ink: string }
export interface TitleVersion extends VersionBase { text: string }
export interface ThumbVersion extends VersionBase { key: string; art: ThumbArt | null; blobUrl: string | null; seenSinceArchive?: boolean }
export interface DescVersion extends VersionBase { lines: string[] | null; hasText: boolean }

export interface ObsVideo {
  id: string; ch: string; niche: Niche | null; fmt: Fmt; pub: number; ageDays: number; tracked: boolean
  title: string; theme: string | null; formulas: string[]; url: string; ytId: string; dur: number | null
  views: number | null; viewsAt: number | null; likes: number; comments: number
  series: SeriesPoint[]; firstIdx: number | null
  titles: TitleVersion[]; thumbs: ThumbVersion[]; descs: DescVersion[]
}
export interface ChannelSnapshot { t: number; date: string; subs: number; views: number }
export interface ChannelSync {
  state: SyncState; last: number; next: number | null; added: number; errorSince: number | null
  msg: string | null; backfill: { done: number; total: number } | null
  /** Derived by the engine (Task 17); absent on the input dataset. */
  label?: string; stateLabel?: string; problemLabel?: string | null; problemPhrase?: string | null
}
export interface ObsChannel {
  id: string; name: string; fullName: string; niche: Niche | null; own: boolean; lang: string
  subs: number; video_limit: number; url: string; handle: string; gender: 'm' | 'f' | 'n'; color: string; ini: string
  sync: ChannelSync; activity: { state: 'ativo' | 'parado'; pausedDays?: number }
  lastIdx: number | null; snapshots: ChannelSnapshot[]
  /** Derived by the engine (Task 17). */
  statusLabel?: string; syncAgeHours?: number
}
export interface FrozenReading {
  id: string; type: string; niche: Niche | null; fmt: Fmt | null; target: { kind: 'niche' | 'video'; niche?: Niche; video?: string; fmt?: Fmt }
  seal: string; generatedAt: number; model: string
  sent: Record<string, unknown> & { text: string; asOf: number }
  analysis: Record<string, unknown>; text: { title?: string; lead: string; items: string[]; theme?: string }
  base?: unknown; effects?: unknown[]
}
export type RequestState = 'na fila' | 'trabalhando' | 'publicado' | 'atrasado' | 'sem máquina' | 'nova tentativa' | 'falhou' | 'recusado (dado velho)' | 'liberado pelo vigia'
export interface ForjaRequest {
  id: string; type: string; niche: Niche; target: { kind: 'niche' | 'video'; niche: Niche; video?: string; fmt?: Fmt }
  state: RequestState; createdAt: number; claimedAt: number | null; startedAt: number | null; publishedAt: number | null
  failedAt: number | null; attempt: number; refusedReason: string | null; readingId: string | null; seq?: number
}
export interface Dataset {
  now: number; seriesStart: number; snap0: number; obsStart: number
  channels: ObsChannel[]; videos: ObsVideo[]
  sync: { last: number; next: number | null }
  readings: FrozenReading[]; requests: ForjaRequest[]
  queue: { lastPollAt: number | null; tickMinutes: number; capabilities: string[] }
}
