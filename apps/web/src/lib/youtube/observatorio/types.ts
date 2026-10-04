import type { Niche, NicheDef } from './niche'
export type { Niche, NicheScope, NicheDef } from './niche' // single definition
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
  views: number | null; viewsAt: number | null
  /** null = the count was never read (a video still being fetched): no engagement, never 0% */
  likes: number | null; comments: number
  series: SeriesPoint[]; firstIdx: number | null
  /** The daily read was cut by the lookback cap (ds.dailyCappedFrom): the series does NOT start at publication, so no day-0 baseline may be assumed. */
  truncated?: boolean
  titles: TitleVersion[]; thumbs: ThumbVersion[]; descs: DescVersion[]
}
export interface ChannelSnapshot { t: number; date: string; subs: number; views: number }
export interface ChannelSync {
  /** Newest OK sync; null = never synced OK (never invented from added_at). */
  state: SyncState; last: number | null; next: number | null; added: number | null; errorSince: number | null
  msg: string | null; backfill: { done: number; total: number } | null
  /** Derived by the engine (Task 17); absent on the input dataset. */
  label?: string; stateLabel?: string; problemLabel?: string | null; problemPhrase?: string | null
}
export interface ObsChannel {
  id: string; name: string; fullName: string; niche: Niche | null; own: boolean; lang: string
  /** null = o YouTube não informa (canal esconde a contagem de inscritos). */
  subs: number | null; video_limit: number; url: string; handle: string; gender: 'm' | 'f' | 'n'; color: string; ini: string
  sync: ChannelSync; activity: { state: 'ativo' | 'parado'; pausedDays?: number }
  lastIdx: number | null; snapshots: ChannelSnapshot[]
  /** Derived by the engine (Task 17). */
  statusLabel?: string; syncAgeHours?: number
}
/** A video of the data a reading was made from (dados.js:937 baseAt), frozen with the reading. */
export interface ReadingBaseVideo { id: string; ch: string; title: string; theme: string | null; formulas: string[]; mult: number; weak: boolean; method?: string | null; n?: number }
/** The frozen base of a reading: which channels and videos it read, up to when. */
export interface ReadingBase { fmt?: Fmt; t?: number; asOf: number; niche?: string; windowDays: number | null; channels: string[]; excluded: string[]; videos: ReadingBaseVideo[] }
/** A video reading's frozen verdict per change (dados.js:1245). */
export interface ReadingEffect { change: string; status: string; numbers: string | null; reason: string; collected: number | null }
export interface FrozenReading {
  id: string; type: string; niche: Niche | null; fmt?: Fmt | null; target?: { kind: 'niche' | 'video'; niche?: Niche; video?: string; fmt?: Fmt }
  seal: string; generatedAt: number; model?: string; typeLabel?: string; scenario?: boolean
  sent: Record<string, unknown> & { text: string; asOf: number; asOfIdx?: number; changeIds?: string[]; windowDays?: number; nChannels?: number; nOutliers?: number }
  analysis: Record<string, unknown> & { nOutliers?: number }; text: { title?: string; lead: string; items: string[]; theme?: string }
  base?: ReadingBase; effects?: ReadingEffect[]; viewsThen?: number | null
}
export type RequestState = 'na fila' | 'trabalhando' | 'publicado' | 'atrasado' | 'sem máquina' | 'nova tentativa' | 'falhou' | 'recusado (dado velho)' | 'liberado pelo vigia'
/** Instants a request names that may still lie in the future: they live here, never in the field (nothing after NOW). */
export type ForjaForecast = Partial<Record<'claimedAt' | 'startedAt' | 'publishedAt' | 'releasedAt' | 'failedAt' | 'refusedAt' | 'busySince', number>>
export interface ForjaRequest {
  id: string; type: string; niche: Niche; target: { kind: 'niche' | 'video'; niche?: Niche; video?: string; fmt?: Fmt }
  state: RequestState; createdAt: number; claimedAt: number | null; startedAt: number | null; publishedAt: number | null
  failedAt: number | null; attempt: number; refusedReason: string | null; readingId: string | null; seq?: number
  /** Optional detail (Task 31): what the DB row or the queue knows beyond the state. */
  status?: string; maxAttempts?: number; video?: string | null; scenario?: boolean; composed?: boolean
  refusedAt?: number | null; releasedAt?: number | null; releasedBy?: string | null; failReason?: string | null; retryReason?: string | null
  refusedDataAsOf?: number | null; busyWith?: string | null; busySince?: number | null
  attempts?: Array<{ claimedAt: number; endedAt: number | null; endedAtForecast?: number; result?: string }> | null
  /** Minutes waiting since the request (or its release) entered the queue; derived from NOW when absent. */
  waitingMinutes?: number | null
  /** Queue relationship: "atrás do de IA" and the id of the request ahead. */
  stateNote?: string | null; behind?: string | null; behindAfter?: string | null
  forecast?: ForjaForecast | null
  /** Canonical header label (CONVENCOES line 218), filled by the engine. */
  statusLabel?: string
  queuePos?: number; queueSize?: number; firstInQueue?: boolean; quotaConsumed?: boolean
}
export interface Dataset {
  now: number; seriesStart: number; snap0: number; obsStart: number
  /** Start (ms, SP midnight) of the daily lookback when the cap cut into the series (seriesStart older than the cap); null = whole series read. */
  dailyCappedFrom: number | null
  channels: ObsChannel[]; videos: ObsVideo[]
  /** last = newest OK sync of any competitor channel; null when none ever synced. */
  sync: { last: number | null; next: number | null }
  readings: FrozenReading[]; requests: ForjaRequest[]
  queue: { lastPollAt: number | null; tickMinutes: number; capabilities: string[] }
  /** Os nichos do site (youtube_niches). Ausente ou vazio (dataset antigo, oráculo, tabela ausente) = os dois de fábrica. */
  niches?: NicheDef[]
}
