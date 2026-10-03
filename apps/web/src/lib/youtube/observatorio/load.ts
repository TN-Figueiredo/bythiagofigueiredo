// Observatório v2 — DB rows → engine Dataset. One query per table (paged, `in()` chunked), then a pure mapping.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { Dataset, ObsChannel, ObsVideo, TitleVersion, ThumbVersion, DescVersion, SeriesPoint, Precision, Niche, Fmt, FrozenReading, ForjaRequest, RequestState, ChannelSnapshot } from './types'
import { DAY, H, spDayStart, spDateStart } from './time'
import { RULES } from './rules'
import { formulasOf, THEME } from './catalog'
import { deriveSyncState, backfillProgress } from './channels'

/* ------------------------------------------------------------------ row shapes (mirror database.types.ts) */
export interface SettingsRow { series_started_at: string | null; channel_limit: number }
export interface ChannelRow {
  id: string; channel_id: string; channel_name: string; thumbnail_url: string | null; subscriber_count: number | null; niche: string | null
  video_limit: number; youtube_video_count: number | null; sync_status: string; sync_error: string | null; sync_error_since: string | null
  last_ok_synced_at: string | null; last_synced_at: string | null; full_sync_completed_at: string | null; added_at: string | null
}
export interface OwnChannelRow { id: string; channel_id: string; name: string; handle: string; subscriber_count: number; last_synced_at: string | null }
export interface VideoRow {
  id: string; competitor_channel_id: string; video_id: string; title: string | null; view_count: number | null; like_count: number | null
  comment_count: number | null; duration_seconds: number | null; published_at: string | null; is_short: boolean | null; last_checked_at: string | null
  tags: string[] | null; thumbnail_url: string | null
}
export interface OwnVideoRow {
  id: string; channel_id: string; youtube_video_id: string; title: string; view_count: number; like_count: number; comment_count: number
  duration_seconds: number; published_at: string; updated_at: string; tags: string[]
}
export interface VersionRow {
  id: string; video_id: string; field: string; value_text: string | null; value_hash: string; has_text: boolean; thumb_blob_url: string | null
  first_seen_at: string; last_seen_at: string; window_start: string | null; precision: string; is_current: boolean
}
export interface LegacyChangeRow { id: string; video_id: string; change_type: string; old_title: string | null; new_title: string | null; detected_at: string | null }
export interface DailyRow { video_id: string; snap_date: string; views: number; likes: number | null; comments: number | null; taken_at: string }
export interface SnapshotRow { id?: string; competitor_channel_id: string; snapshot_date: string; subscriber_count: number | null; view_count: number | null; video_count: number | null }
/** P4 (Task 29) tables: shapes from the plan's migration; jsonb columns stay `unknown` and are narrowed here. */
export interface ReadingRow {
  id: string; task_type: string; niche: string | null; video_id: string | null; fmt: string | null; model: string; generated_at: string
  sent: unknown; analysis: unknown; text: unknown; evidence: unknown
}
export interface TaskRow {
  id: string; task_type: string; target_niche: string | null; target_video_id: string | null; target_fmt: string | null; status: string
  requested_at: string; started_at: string | null; completed_at: string | null; failed_at: string | null; refused_at: string | null
  refused_reason: string | null; released_at: string | null; retry_count: number
}
export interface HeartbeatRow { last_poll_at: string; capabilities: string[] }

export interface ObservatoryRows {
  settings: SettingsRow | null; channels: ChannelRow[]; ownChannels: OwnChannelRow[]; videos: VideoRow[]; ownVideos: OwnVideoRow[]
  versions: VersionRow[]; legacyChanges: LegacyChangeRow[]; daily: DailyRow[]; snapshots: SnapshotRow[]
  readings: ReadingRow[]; tasks: TaskRow[]; heartbeat: HeartbeatRow | null
}

/* ------------------------------------------------------------------ constants */
const CHANNEL_COLS = 'id, channel_id, channel_name, thumbnail_url, subscriber_count, niche, video_limit, youtube_video_count, sync_status, sync_error, sync_error_since, last_ok_synced_at, last_synced_at, full_sync_completed_at, added_at'
const VIDEO_COLS = 'id, competitor_channel_id, video_id, title, view_count, like_count, comment_count, duration_seconds, published_at, is_short, last_checked_at, tags, thumbnail_url'
const VERSION_COLS = 'id, video_id, field, value_text, value_hash, has_text, thumb_blob_url, first_seen_at, last_seen_at, window_start, precision, is_current'
const OWN_VIDEO_COLS = 'id, channel_id, youtube_video_id, title, view_count, like_count, comment_count, duration_seconds, published_at, updated_at, tags'
const TASK_COLS = 'id, task_type, target_niche, target_video_id, target_fmt, status, requested_at, started_at, completed_at, failed_at, refused_at, refused_reason, released_at, retry_count'
/** PostgREST `max_rows` (supabase/config.toml): a bigger read is silently truncated, so every list is paged. */
const PAGE = 1000
/** ids per `in()` filter, so the URL stays well under the gateway limit. */
const IN_CHUNK = 500
const SNAPSHOT_DAYS = 90
const READING_DAYS = 90
const TASK_DAYS = 7
/** No upload (any format) for this many days → 'parado'. The mockup fixes it in data; production derives it. */
const PAUSED_AFTER_DAYS = 30
/** The forja cron drains the queue every 10 minutes (CLAUDE.md, "A forja"). */
const FORJA_TICK_MINUTES = 10
const OBS_TASK_TYPES = ['padroes-titulo', 'padroes-titulo-shorts', 'temas', 'resumo-trocas', 'leitura-video'] as const
const CHANNEL_COLORS = ['#E8823C', '#A77CE8', '#3FA9C0', '#D9614A', '#60A5FA', '#46B17E', '#E0A23C', '#BE5A96', '#78B450']
const OWN_COLOR = '#B8481A'

/* ------------------------------------------------------------------ small pure helpers */
const ms = (s: string | null | undefined): number | null => { if (!s) return null; const t = Date.parse(s); return Number.isFinite(t) ? t : null }
const isNiche = (s: string | null | undefined): s is Niche => s === 'viagem' || s === 'ia'
const isFmt = (s: string | null | undefined): s is Fmt => s === 'long' || s === 'short'
const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const precOf = (s: string): Precision | 'first' | null => (s === 'min' || s === '6h' || s === '1d' || s === 'first' ? s : null)
function groupBy<T>(xs: readonly T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const x of xs) { const k = key(x); const l = m.get(k); if (l) l.push(x); else m.set(k, [x]) }
  return m
}
const initials = (name: string) => {
  const w = name.trim().split(/\s+/).filter(Boolean)
  return (w.length >= 2 ? w[0]![0]! + w[1]![0]! : (w[0] ?? '?').slice(0, 2)).toUpperCase()
}
const colorOf = (id: string) => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return CHANNEL_COLORS[h % CHANNEL_COLORS.length]! }
/** Whole days since publication; a scheduled premiere (or clock skew) has pub > now → 0, never negative (winOf has no band below 0). */
const ageOf = (pub: number, now: number) => Math.max(0, Math.floor((now - pub) / DAY))
/** Same rule as competitor-sync (`is_short`), for own videos that have no flag. */
const ownIsShort = (v: OwnVideoRow) => v.duration_seconds <= 60 || v.title.includes('#Shorts')
/** 'YYYY-MM-DD' of the SP calendar day containing `t`. */
const spDate = (t: number) => new Date(spDayStart(t) - 3 * H).toISOString().slice(0, 10) // SP is UTC−3
const dmyOf = (date: string) => { const [y, m, d] = date.slice(0, 10).split('-'); return d + '/' + m + '/' + y }

/** Next 00/06/12/18 slot in São Paulo strictly after `now`. */
export function nextSyncSlot(now: number): number {
  const d0 = spDayStart(now)
  for (let k = 1; k <= 4; k++) { const t = d0 + k * 6 * H; if (t > now) return t }
  return d0 + 4 * 6 * H
}

function activityOf(pubs: number[], now: number): ObsChannel['activity'] {
  if (!pubs.length) return { state: 'ativo' }
  const days = Math.floor((now - Math.max(...pubs)) / DAY)
  return days >= PAUSED_AFTER_DAYS ? { state: 'parado', pausedDays: days } : { state: 'ativo' }
}

/** Latest `temas` reading per niche → video id → theme id (unknown theme ids are dropped). */
function themeMap(readings: readonly ReadingRow[]): Map<string, string> {
  const latest = new Map<string, ReadingRow>()
  for (const r of readings) {
    if (r.task_type !== 'temas') continue
    const k = r.niche ?? '', cur = latest.get(k)
    if (!cur || (ms(r.generated_at) ?? 0) > (ms(cur.generated_at) ?? 0)) latest.set(k, r)
  }
  const out = new Map<string, string>()
  for (const r of latest.values()) {
    if (!Array.isArray(r.evidence)) continue
    for (const e of r.evidence) if (isRecord(e) && typeof e.id === 'string' && typeof e.theme === 'string' && THEME[e.theme]) out.set(e.id, e.theme)
  }
  return out
}

type Base = { id: string; first_seen: number; last_seen: number; current: boolean; prec: Precision | 'first' | null; window: [number, number] | null }
function baseOf(r: VersionRow): Base {
  const fs = ms(r.first_seen_at)!, ws = ms(r.window_start)
  return { id: r.id, first_seen: fs, last_seen: ms(r.last_seen_at) ?? fs, current: r.is_current, prec: precOf(r.precision), window: ws != null ? [ws, fs] : null }
}
/**
 * Legacy `competitor_changes` rows (from_version_id null) → pre-series versions: one "before" version, then one per row
 * (prec '1d', window [detected_at − 1 d, detected_at]). The last legacy "after" IS the first real version when one exists
 * (same value, observed later), so it is merged instead of producing a phantom change.
 */
function withLegacy<T extends Base>(legacy: readonly LegacyChangeRow[], real: T[], pub: number, now: number, before: (l: LegacyChangeRow) => Omit<T, keyof Base>, after: (l: LegacyChangeRow) => Omit<T, keyof Base>): T[] {
  const ls = legacy.map(l => ({ l, d: ms(l.detected_at) })).filter((x): x is { l: LegacyChangeRow; d: number } => x.d != null).sort((a, b) => a.d - b.d)
  if (!ls.length) return real
  const first = ls[0]!
  const out: T[] = [{ id: first.l.id + '/antes', first_seen: Math.min(pub, first.d - DAY), last_seen: first.d - DAY, current: false, prec: '1d', window: null, ...before(first.l) } as T]
  ls.forEach(({ l, d }, i) => {
    const win: [number, number] = [d - DAY, d], next = ls[i + 1]
    if (!next && real.length) { out.push({ ...real[0]!, first_seen: d, prec: '1d', window: win }, ...real.slice(1)); return }
    out.push({ id: l.id, first_seen: d, last_seen: next ? next.d - DAY : now, current: !next, prec: '1d', window: win, ...after(l) } as T)
  })
  return out
}

/* ------------------------------------------------------------------ rows → Dataset (pure) */
export function rowsToDataset(rows: ObservatoryRows, now: number): Dataset {
  const ssAt = ms(rows.settings?.series_started_at)
  // null series start → now, so nothing is "since"
  const seriesStart = ssAt != null ? spDayStart(ssAt) : now
  const snap0 = spDayStart(seriesStart) + 12 * H
  const dayIndex = (date: string) => Math.round((spDateStart(date) + 12 * H - snap0) / DAY)
  const next = nextSyncSlot(now)
  const themes = themeMap(rows.readings)
  const versionsBy = groupBy([...rows.versions].sort((a, b) => (ms(a.first_seen_at) ?? 0) - (ms(b.first_seen_at) ?? 0)), v => v.video_id + '|' + v.field)
  const legacyBy = groupBy(rows.legacyChanges, l => l.video_id + '|' + l.change_type)
  const dailyBy = groupBy(rows.daily, d => d.video_id)
  const videosBy = groupBy(rows.videos, v => v.competitor_channel_id)
  const snapsBy = groupBy(rows.snapshots, s => s.competitor_channel_id)
  const channels: ObsChannel[] = [], videos: ObsVideo[] = []

  for (const c of rows.channels) {
    const limit = Math.min(c.video_limit, RULES.videoLimitMax)
    // a video without published_at cannot be aged or banded: it stays out of the dataset
    const vs = (videosBy.get(c.id) ?? []).map(v => ({ v, pub: ms(v.published_at) })).filter((x): x is { v: VideoRow; pub: number } => x.pub != null).sort((a, b) => b.pub - a.pub)
    const nTracked = Math.min(vs.length, limit)
    const state = deriveSyncState({ ...c, tracked: nTracked }, now)
    let lastIdx: number | null = null
    vs.forEach(({ v, pub }, k) => {
      const fmt: Fmt = v.is_short ? 'short' : 'long'
      // nominal 12:00 SP per record (like the mockup); the real taken_at stays in the DB
      const series: SeriesPoint[] = (dailyBy.get(v.id) ?? []).map(d => { const idx = dayIndex(d.snap_date); return { idx, t: snap0 + idx * DAY, views: Number(d.views) } })
        .sort((a, b) => a.idx - b.idx)
      for (const p of series) if (lastIdx == null || p.idx > lastIdx) lastIdx = p.idx
      const realTitles: TitleVersion[] = (versionsBy.get(v.id + '|title') ?? []).map(r => ({ ...baseOf(r), text: r.value_text ?? '' }))
      let titles = withLegacy<TitleVersion>(legacyBy.get(v.id + '|title') ?? [], realTitles, pub, now, l => ({ text: l.old_title ?? '' }), l => ({ text: l.new_title ?? '' }))
      if (!titles.length) titles = [{ id: v.id + '/title', first_seen: pub, last_seen: now, current: true, prec: 'first', window: null, text: v.title ?? '' }]
      const thumbs: ThumbVersion[] = (versionsBy.get(v.id + '|thumb') ?? []).map(r => ({ ...baseOf(r), key: r.value_hash, art: null, blobUrl: r.thumb_blob_url }))
      const realDescs: DescVersion[] = (versionsBy.get(v.id + '|desc') ?? []).map(r => {
        const hasText = r.has_text && r.value_text != null
        return { ...baseOf(r), lines: hasText ? r.value_text!.split('\n') : null, hasText }
      })
      const descs = withLegacy<DescVersion>(legacyBy.get(v.id + '|description') ?? [], realDescs, pub, now, () => ({ lines: null, hasText: false }), () => ({ lines: null, hasText: false }))
      const title = v.title ?? titles[titles.length - 1]!.text
      videos.push({
        id: v.id, ch: c.id, niche: isNiche(c.niche) ? c.niche : null, fmt, pub, ageDays: ageOf(pub, now), tracked: k < nTracked,
        title, theme: themes.get(v.id) ?? null, formulas: formulasOf(title),
        url: fmt === 'short' ? 'https://www.youtube.com/shorts/' + v.video_id : 'https://www.youtube.com/watch?v=' + v.video_id, ytId: v.video_id, dur: v.duration_seconds,
        views: v.view_count, viewsAt: ms(v.last_checked_at) ?? ms(c.last_ok_synced_at) ?? now, likes: v.like_count ?? 0, comments: v.comment_count ?? 0,
        series, firstIdx: series.length ? series[0]!.idx : null, titles, thumbs, descs,
      })
    })
    const snapshots: ChannelSnapshot[] = (snapsBy.get(c.id) ?? []).filter(s => s.subscriber_count != null).sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
      .map(s => ({ t: spDateStart(s.snapshot_date) + 12 * H, date: dmyOf(s.snapshot_date), subs: s.subscriber_count!, views: s.view_count ?? 0 }))
    channels.push({
      id: c.id, name: c.channel_name, fullName: c.channel_name, niche: isNiche(c.niche) ? c.niche : null, own: false, lang: '',
      subs: c.subscriber_count ?? 0, video_limit: limit, url: 'https://www.youtube.com/channel/' + c.channel_id, handle: '', gender: 'n', color: colorOf(c.id), ini: initials(c.channel_name),
      sync: {
        state, last: ms(c.last_ok_synced_at) ?? ms(c.added_at) ?? now, next, added: ms(c.added_at) ?? now, errorSince: ms(c.sync_error_since), msg: c.sync_error,
        backfill: state === 'backfill' ? backfillProgress({ tracked: nTracked, video_limit: limit, youtube_video_count: c.youtube_video_count }) : null,
      },
      activity: activityOf(vs.map(x => x.pub), now),
      lastIdx: state === 'backfill' ? null : lastIdx,
      snapshots,
    })
  }

  const ownVideosBy = groupBy(rows.ownVideos, v => v.channel_id)
  for (const oc of rows.ownChannels) {
    const vs = (ownVideosBy.get(oc.id) ?? []).map(v => ({ v, pub: ms(v.published_at) })).filter((x): x is { v: OwnVideoRow; pub: number } => x.pub != null).sort((a, b) => b.pub - a.pub)
    const last = ms(oc.last_synced_at) ?? now
    vs.forEach(({ v, pub }, k) => {
      const fmt: Fmt = ownIsShort(v) ? 'short' : 'long'
      videos.push({
        id: v.id, ch: oc.id, niche: null, fmt, pub, ageDays: ageOf(pub, now), tracked: k < RULES.videoLimitMax,
        title: v.title, theme: themes.get(v.id) ?? null, formulas: formulasOf(v.title),
        url: fmt === 'short' ? 'https://www.youtube.com/shorts/' + v.youtube_video_id : 'https://www.youtube.com/watch?v=' + v.youtube_video_id, ytId: v.youtube_video_id, dur: v.duration_seconds,
        views: v.view_count, viewsAt: ms(v.updated_at) ?? last, likes: v.like_count, comments: v.comment_count,
        // own videos have no daily record and no versions: the engine treats them as "sem série"
        series: [], firstIdx: null, titles: [{ id: v.id + '/title', first_seen: pub, last_seen: now, current: true, prec: 'first', window: null, text: v.title }], thumbs: [], descs: [],
      })
    })
    channels.push({
      id: oc.id, name: oc.name, fullName: oc.name, niche: null, own: true, lang: '', subs: oc.subscriber_count, video_limit: RULES.videoLimitMax,
      url: 'https://www.youtube.com/channel/' + oc.channel_id, handle: oc.handle, gender: 'n', color: OWN_COLOR, ini: initials(oc.name),
      sync: { state: 'ok', last, next, added: last, errorSince: null, msg: null, backfill: null },
      activity: activityOf(vs.map(x => x.pub), now), lastIdx: null, snapshots: [],
    })
  }

  const okSyncs = rows.channels.map(c => ms(c.last_ok_synced_at)).filter((x): x is number => x != null)
  const added = rows.channels.map(c => ms(c.added_at)).filter((x): x is number => x != null)
  return {
    now, seriesStart, snap0, obsStart: added.length ? Math.min(...added) : seriesStart,
    channels, videos,
    sync: { last: okSyncs.length ? Math.max(...okSyncs) : null, next },
    readings: rows.readings.map(r => toReading(r)).filter((x): x is FrozenReading => x != null),
    requests: rows.tasks.map(toRequest).filter((x): x is ForjaRequest => x != null),
    queue: { lastPollAt: ms(rows.heartbeat?.last_poll_at), tickMinutes: FORJA_TICK_MINUTES, capabilities: rows.heartbeat?.capabilities ?? [] },
  }
}

function toReading(r: ReadingRow): FrozenReading | null {
  const generatedAt = ms(r.generated_at)
  if (generatedAt == null) return null
  const niche = isNiche(r.niche) ? r.niche : null, fmt = isFmt(r.fmt) ? r.fmt : null
  const sent = isRecord(r.sent) ? r.sent : {}, text = isRecord(r.text) ? r.text : {}
  const asOf = typeof sent.asOf === 'number' ? sent.asOf : ms(typeof sent.asOf === 'string' ? sent.asOf : null) ?? generatedAt
  return {
    id: r.id, type: r.task_type, niche, fmt,
    target: r.video_id ? { kind: 'video', ...(niche ? { niche } : {}), video: r.video_id, ...(fmt ? { fmt } : {}) } : { kind: 'niche', ...(niche ? { niche } : {}), ...(fmt ? { fmt } : {}) },
    // The seal's final wording (with the window) is Task 32's; until P4 no screen renders readings.
    seal: 'forja · ' + r.model + ' · ' + r.task_type, generatedAt, model: r.model,
    sent: { ...sent, text: typeof sent.text === 'string' ? sent.text : '', asOf },
    analysis: isRecord(r.analysis) ? r.analysis : {},
    text: {
      ...(typeof text.title === 'string' ? { title: text.title } : {}), lead: typeof text.lead === 'string' ? text.lead : '',
      items: Array.isArray(text.items) ? text.items.filter((x): x is string => typeof x === 'string') : [],
      ...(typeof text.theme === 'string' ? { theme: text.theme } : {}),
    },
  }
}

const STATE_OF: Record<string, RequestState> = { pending: 'na fila', running: 'trabalhando', completed: 'publicado', failed: 'falhou', refused: 'recusado (dado velho)', stale: 'liberado pelo vigia' }
function toRequest(t: TaskRow): ForjaRequest | null {
  const state = STATE_OF[t.status], createdAt = ms(t.requested_at)
  if (!state || createdAt == null || !isNiche(t.target_niche) || !(OBS_TASK_TYPES as readonly string[]).includes(t.task_type)) return null
  const fmt = isFmt(t.target_fmt) ? t.target_fmt : undefined
  return {
    id: t.id, type: t.task_type, niche: t.target_niche,
    target: t.target_video_id ? { kind: 'video', niche: t.target_niche, video: t.target_video_id, ...(fmt ? { fmt } : {}) } : { kind: 'niche', niche: t.target_niche, ...(fmt ? { fmt } : {}) },
    state, createdAt, claimedAt: ms(t.started_at), startedAt: ms(t.started_at), publishedAt: ms(t.completed_at),
    failedAt: ms(t.failed_at) ?? ms(t.refused_at), attempt: t.retry_count + 1, refusedReason: t.refused_reason, readingId: null,
  }
}

/* ------------------------------------------------------------------ DB reads */
interface PgErr { message: string; code?: string }
interface RangeQuery { range(from: number, to: number): PromiseLike<{ data: unknown; error: PgErr | null }> }
export class ObservatoryLoadError extends Error {
  constructor(public table: string, public code: string | undefined, message: string) { super('observatório: falha ao ler ' + table + ': ' + message); this.name = 'ObservatoryLoadError' }
}
/** Pages a read until a short page; a DB error throws (never an empty list in disguise). */
async function readAll<T>(table: string, build: () => RangeQuery): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) throw new ObservatoryLoadError(table, error.code, error.message)
    const page = Array.isArray(data) ? (data as T[]) : []
    out.push(...page)
    if (page.length < PAGE) return out
  }
}
async function readIn<T>(table: string, ids: readonly string[], build: (chunk: string[]) => RangeQuery): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) out.push(...await readAll<T>(table, () => build(ids.slice(i, i + IN_CHUNK))))
  return out
}
/** undefined table / undefined column, from Postgres or from the PostgREST schema cache. */
const MISSING = new Set(['42P01', '42703', 'PGRST205', 'PGRST204'])
/**
 * The P4 tables (`competitor_readings`, `forja_heartbeat`) and the typed `youtube_intelligence_tasks` columns arrive in
 * Task 29. Until then a missing table/column reads as empty. Task 29 removes this guard and reads them normally.
 */
async function readOptional<T>(table: string, build: () => RangeQuery): Promise<T[]> {
  try { return await readAll<T>(table, build) } catch (e) {
    if (e instanceof ObservatoryLoadError && e.code && MISSING.has(e.code)) return []
    throw e
  }
}

export interface LoadOptions { siteId: string; now: number; supabase?: SupabaseClient }

export async function loadRows(opts: LoadOptions): Promise<ObservatoryRows> {
  const sb = opts.supabase ?? getSupabaseServiceClient()
  const { siteId, now } = opts
  const st = await sb.from('competitor_settings').select('series_started_at, channel_limit').eq('site_id', siteId).maybeSingle()
  if (st.error) throw new ObservatoryLoadError('competitor_settings', st.error.code, st.error.message)
  const settings = (st.data as SettingsRow | null) ?? null
  const ssAt = ms(settings?.series_started_at)
  const seriesStart = ssAt != null ? spDayStart(ssAt) : now

  const [channels, ownChannels, ownVideos, legacyChanges, readings, tasks, heartbeats] = await Promise.all([
    readAll<ChannelRow>('competitor_channels', () => sb.from('competitor_channels').select(CHANNEL_COLS).eq('site_id', siteId).order('id')),
    readAll<OwnChannelRow>('youtube_channels', () => sb.from('youtube_channels').select('id, channel_id, name, handle, subscriber_count, last_synced_at').eq('site_id', siteId).order('id')),
    readAll<OwnVideoRow>('youtube_videos', () => sb.from('youtube_videos').select(OWN_VIDEO_COLS).eq('site_id', siteId).eq('is_hidden', false).order('id')),
    readAll<LegacyChangeRow>('competitor_changes', () => sb.from('competitor_changes').select('id, video_id, change_type, old_title, new_title, detected_at')
      .eq('site_id', siteId).is('from_version_id', null).in('change_type', ['title', 'description']).order('id')),
    readOptional<ReadingRow>('competitor_readings', () => sb.from('competitor_readings').select('id, task_type, niche, video_id, fmt, model, generated_at, sent, analysis, text, evidence')
      .eq('site_id', siteId).gte('generated_at', new Date(now - READING_DAYS * DAY).toISOString()).order('id')),
    readOptional<TaskRow>('youtube_intelligence_tasks', () => sb.from('youtube_intelligence_tasks').select(TASK_COLS)
      .eq('site_id', siteId).in('task_type', [...OBS_TASK_TYPES]).gte('requested_at', new Date(now - TASK_DAYS * DAY).toISOString()).order('id')),
    readOptional<HeartbeatRow>('forja_heartbeat', () => sb.from('forja_heartbeat').select('last_poll_at, capabilities').eq('site_id', siteId).order('site_id')),
  ])
  const channelIds = channels.map(c => c.id)
  const [videos, snapshots] = await Promise.all([
    readIn<VideoRow>('competitor_videos', channelIds, ids => sb.from('competitor_videos').select(VIDEO_COLS).in('competitor_channel_id', ids).order('id')),
    readIn<SnapshotRow>('competitor_channel_snapshots', channelIds, ids => sb.from('competitor_channel_snapshots').select('id, competitor_channel_id, snapshot_date, subscriber_count, view_count, video_count')
      .in('competitor_channel_id', ids).gte('snapshot_date', spDate(now - SNAPSHOT_DAYS * DAY)).order('id')),
  ])
  const videoIds = videos.map(v => v.id)
  const [versions, daily] = await Promise.all([
    readIn<VersionRow>('competitor_video_versions', videoIds, ids => sb.from('competitor_video_versions').select(VERSION_COLS).in('video_id', ids).order('id')),
    readIn<DailyRow>('competitor_video_daily', videoIds, ids => sb.from('competitor_video_daily').select('video_id, snap_date, views, likes, comments, taken_at')
      .in('video_id', ids).gte('snap_date', spDate(seriesStart - DAY)).order('video_id').order('snap_date')),
  ])
  return { settings, channels, ownChannels, videos, ownVideos, versions, legacyChanges, daily, snapshots, readings, tasks, heartbeat: heartbeats[0] ?? null }
}

export async function loadDataset(opts: LoadOptions): Promise<Dataset> {
  return rowsToDataset(await loadRows(opts), opts.now)
}
