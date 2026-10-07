// Observatório v2 — DB rows → engine Dataset. One query per table (paged, `in()` chunked), then a pure mapping.
import { isCertainShort } from '@/lib/youtube/short-classifier'
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { Dataset, ObsChannel, ObsVideo, TitleVersion, ThumbVersion, DescVersion, SeriesPoint, Precision, Niche, Fmt, FrozenReading, ReadingBase, ReadingEffect, ForjaRequest, ChannelSnapshot } from './types'
import { DAY, H, spDayStart, spDateStart, spDateOf } from './time'
import { RULES } from './rules'
import { formulasOf, THEME } from './catalog'
import { deriveSyncState, backfillProgress } from './channels'
import { requestStateOf } from './forja/states'
import { BUILTIN_NICHES, forjaOrder } from './niche'
import { ObservatoryLoadError, nicheDefs, readNiches, type NicheRow } from './niches-db'
export { ObservatoryLoadError } from './niches-db'

/* ------------------------------------------------------------------ row shapes (mirror database.types.ts) */
export interface SettingsRow { series_started_at: string | null; channel_limit: number }
export interface ChannelRow {
  id: string; channel_id: string; channel_name: string; thumbnail_url: string | null; subscriber_count: number | null; niche: string | null
  video_limit: number; youtube_video_count: number | null; sync_status: string; sync_error: string | null; sync_error_since: string | null
  last_ok_synced_at: string | null; last_synced_at: string | null; full_sync_completed_at: string | null; added_at: string | null
}
export interface OwnChannelRow { id: string; channel_id: string; name: string; handle: string; subscriber_count: number; last_synced_at: string | null; locale?: string | null; created_at?: string | null; niche?: string | null; thumbnail_url?: string | null }
export interface VideoRow {
  id: string; competitor_channel_id: string; video_id: string; title: string | null; view_count: number | null; like_count: number | null
  comment_count: number | null; duration_seconds: number | null; published_at: string | null; is_short: boolean | null; last_checked_at: string | null
  tags: string[] | null; thumbnail_url: string | null
  /** Optional in the type so a row built without it reads as "not pinned"; the DB read always selects it. */
  pinned_at?: string | null
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
  /** The forja task that produced the reading (completeReading writes it): a published request points at its reading. */
  task_id?: string | null
}
export interface TaskRow {
  id: string; task_type: string; target_niche: string | null; target_video_id: string | null; target_fmt: string | null; status: string
  requested_at: string; started_at: string | null; completed_at: string | null; failed_at: string | null; refused_at: string | null
  refused_reason: string | null; released_at: string | null; retry_count: number
  /** The forja's reason for a final failure (services/youtube.ts fail route); cleared on a requeue. */
  error_message?: string | null
}
export interface HeartbeatRow { last_poll_at: string; capabilities: string[] }

export interface ObservatoryRows {
  settings: SettingsRow | null; channels: ChannelRow[]; ownChannels: OwnChannelRow[]; videos: VideoRow[]; ownVideos: OwnVideoRow[]
  versions: VersionRow[]; legacyChanges: LegacyChangeRow[]; daily: DailyRow[]; snapshots: SnapshotRow[]
  readings: ReadingRow[]; tasks: TaskRow[]; heartbeat: HeartbeatRow | null
  /** Os nichos do site (youtube_niches). null / ausente = a tabela ainda não existe neste banco: valem os dois de fábrica. */
  niches?: NicheRow[] | null
}

/* ------------------------------------------------------------------ constants */
const CHANNEL_COLS = 'id, channel_id, channel_name, thumbnail_url, subscriber_count, niche, video_limit, youtube_video_count, sync_status, sync_error, sync_error_since, last_ok_synced_at, last_synced_at, full_sync_completed_at, added_at'
const VIDEO_COLS = 'id, competitor_channel_id, video_id, title, view_count, like_count, comment_count, duration_seconds, published_at, is_short, last_checked_at, tags, thumbnail_url, pinned_at'
const VERSION_COLS = 'id, video_id, field, value_text, value_hash, has_text, thumb_blob_url, first_seen_at, last_seen_at, window_start, precision, is_current'
const OWN_VIDEO_COLS = 'id, channel_id, youtube_video_id, title, view_count, like_count, comment_count, duration_seconds, published_at, updated_at, tags'
/** The task columns every reader of the observatory queue selects (the loader and services/forja-queue). */
export const TASK_COLS = 'id, task_type, target_niche, target_video_id, target_fmt, status, requested_at, started_at, completed_at, failed_at, refused_at, refused_reason, released_at, retry_count, error_message'
/** PostgREST `max_rows` (supabase/config.toml): a bigger read is silently truncated, so every list is paged. */
const PAGE = 1000
/**
 * ids per `in()` filter, so the URL stays well under the gateway limit. The local gateway answers 414 above ~8 KB
 * (measured: 200 uuids = 7.9 KB ok, 250 = 9.8 KB → 414); 500 broke any site with more than ~200 videos
 * (test/integration/observatorio-seed.test.ts). 150 uuids ≈ 5.9 KB plus the select list.
 */
const IN_CHUNK = 150
/** Parallel `in()` chunk reads per table. */
const IN_CHUNK_CONCURRENCY = 4
const SNAPSHOT_DAYS = 90
/**
 * Daily-record lookback cap. The engine reads the daily series in two ways: (1) expectedCurve/effect look at most 7 + 7 days
 * around a change, and changes only matter within 90 days; (2) vpdSince/vpd7 use the series from seriesStart. (1) is far
 * inside 365 d; (2) needs the whole series since seriesStart, so it is kept, but capped at 365 d (a video older than that
 * contributes its last year; nothing the screens show looks further back than 90 d + the 14 d change window).
 */
const DAILY_MAX_DAYS = 365
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
/** Os slugs dos nichos de fábrica: o que vale quando quem chama não diz quais nichos o site tem. */
const BUILTIN_IDS: ReadonlySet<string> = new Set(BUILTIN_NICHES.map(n => n.id))
/** O valor é um nicho do site? Um slug fora da lista vira null ("sem nicho"): o canal continua na tela, em Todos e no grupo Sem nicho. */
const nicheIn = (known: ReadonlySet<string>) => (s: string | null | undefined): s is Niche => s != null && known.has(s)
const isFmt = (s: string | null | undefined): s is Fmt => s === 'long' || s === 'short'
const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const precOf = (s: string): Precision | 'first' | null => (s === 'min' || s === '6h' || s === '1d' || s === 'first' ? s : null)
function groupBy<T>(xs: readonly T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const x of xs) { const k = key(x); const l = m.get(k); if (l) l.push(x); else m.set(k, [x]) }
  return m
}
/**
 * Avatar initials as the mockup draws them (dados.js `ini`): capitals, except for an all-lowercase name ("bald and bankrupt" → "bb"),
 * English articles/conjunctions are skipped ("The AI Advantage" → "AA"), and one camel-cased word gives its two capitals
 * ("tnFigueiredo" → "tF").
 */
const SKIP_INI = new Set(['the', 'and', 'of', 'a', 'an', '&'])
/** Sufixo de idioma no fim do nome ("tnFigueiredo EN", "Canal (PT)"): não entra nas iniciais; quem identifica é o nome. */
const LANG_SUFFIX = /\s+(?:[-–|·]\s*)?[(\[]?(?:PT-BR|EN|PT|BR|ES)[)\]]?$/
const isCap = (w: string) => { const c = [...w][0] ?? ''; return c !== c.toLowerCase() }
export const initials = (name: string): string => {
  const trimmed = name.trim(), base = trimmed.replace(LANG_SUFFIX, '').trim() || trimmed
  const all = base.split(/\s+/).filter(Boolean)
  const sig = all.filter(x => !SKIP_INI.has(x.toLowerCase())), words = sig.length ? sig : all
  // duas palavras com maiúscula vencem ("Thiago testa IA" → TI); senão as duas primeiras ("Vou sem volta" → VS)
  const caps = words.filter(isCap), pick = caps.length >= 2 ? caps : words
  if (pick.length >= 2) { const ini = [...pick[0]!][0]! + [...pick[1]!][0]!; return base === base.toLowerCase() ? ini : ini.toUpperCase() }
  const one = [...(pick[0] ?? '?')]
  const cap = one.slice(1).find(ch => ch !== ch.toLowerCase())
  return one[0]! + (cap ?? one[1] ?? '')
}
const colorOf = (id: string) => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return CHANNEL_COLORS[h % CHANNEL_COLORS.length]! }
/** Whole days since publication; a scheduled premiere (or clock skew) has pub > now → 0, never negative (winOf has no band below 0). */
const ageOf = (pub: number, now: number) => Math.max(0, Math.floor((now - pub) / DAY))
/** Same rule as competitor-sync (`is_short`), for own videos that have no flag. */
const ownIsShort = (v: OwnVideoRow) => isCertainShort(v.duration_seconds) || v.title.includes('#Shorts')
const spDate = spDateOf
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
 * (same value, observed later), so it is merged instead of producing a phantom change. `sameAsReal` guards the merge:
 * when the real first version carries a different value, both are kept (the title really changed in between).
 */
function withLegacy<T extends Base>(legacy: readonly LegacyChangeRow[], real: T[], pub: number, now: number, before: (l: LegacyChangeRow) => Omit<T, keyof Base>, after: (l: LegacyChangeRow) => Omit<T, keyof Base>, sameAsReal: (l: LegacyChangeRow, r: T) => boolean = () => true): T[] {
  const ls = legacy.map(l => ({ l, d: ms(l.detected_at) })).filter((x): x is { l: LegacyChangeRow; d: number } => x.d != null).sort((a, b) => a.d - b.d)
  if (!ls.length) return real
  const first = ls[0]!
  // the value before the first legacy change: when the video came out at least a day earlier, it is the publication's
  // (the daily sync watched it from then: precision 'first', first_seen = pub); otherwise it was only seen the day before
  const fromPub = pub <= first.d - DAY
  const out: T[] = [{ id: first.l.id + '/antes', first_seen: fromPub ? pub : first.d - DAY, last_seen: first.d - DAY, current: false, prec: fromPub ? 'first' : '1d', window: null, ...before(first.l) } as T]
  ls.forEach(({ l, d }, i) => {
    const win: [number, number] = [d - DAY, d], next = ls[i + 1]
    if (!next && real.length && sameAsReal(l, real[0]!)) { out.push({ ...real[0]!, first_seen: d, prec: '1d', window: win }, ...real.slice(1)); return }
    const keepsReal = !next && real.length > 0 // different value: the real versions follow, so this one is no longer current
    out.push({ id: l.id, first_seen: d, last_seen: next ? next.d - DAY : keepsReal ? Math.max(d, real[0]!.first_seen) : now, current: !next && !keepsReal, prec: '1d', window: win, ...after(l) } as T)
    if (keepsReal) out.push(...real)
  })
  return out
}

/** taken_at as epoch ms when it is a valid instant inside the record's own SP day; else null (caller falls back to nominal). */
function realReadAt(d: DailyRow, dayStart: number): number | null {
  const t = ms(d.taken_at)
  return t != null && t >= dayStart && t < dayStart + DAY ? t : null
}

/* ------------------------------------------------------------------ rows → Dataset (pure) */
export function rowsToDataset(rows: ObservatoryRows, now: number): Dataset {
  const ssAt = ms(rows.settings?.series_started_at)
  // null series start → now, so nothing is "since"
  const seriesStart = ssAt != null ? spDayStart(ssAt) : now
  const snap0 = spDayStart(seriesStart) + 12 * H
  const dayIndex = (date: string) => Math.round((spDateStart(date) + 12 * H - snap0) / DAY)
  const next = nextSyncSlot(now)
  const cappedFrom = dailyCappedFrom(seriesStart, now)
  const themes = themeMap(rows.readings)
  const niches = nicheDefs(rows.niches), known: ReadonlySet<string> = new Set(niches.map(n => n.id)), isNiche = nicheIn(known)
  const versionsBy = groupBy([...rows.versions].sort((a, b) => (ms(a.first_seen_at) ?? 0) - (ms(b.first_seen_at) ?? 0)), v => v.video_id + '|' + v.field)
  const legacyBy = groupBy(rows.legacyChanges, l => l.video_id + '|' + l.change_type)
  const dailyBy = groupBy(rows.daily, d => d.video_id)
  const videosBy = groupBy(rows.videos, v => v.competitor_channel_id)
  const snapsBy = groupBy(rows.snapshots, s => s.competitor_channel_id)
  const channels: ObsChannel[] = [], videos: ObsVideo[] = []

  // the order the channels were added (dados.js lists them so; every per-channel list follows it), never the uuid
  // order the rows come in; same instant → name, then id, so the order is stable
  const byAdded = [...rows.channels].sort((a, b) => (ms(a.added_at) ?? Infinity) - (ms(b.added_at) ?? Infinity) || a.channel_name.localeCompare(b.channel_name, 'pt-BR') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  for (const c of byAdded) {
    const limit = Math.min(c.video_limit, RULES.videoLimitMax)
    // a video without published_at cannot be aged or banded: it stays out of the dataset
    const vs = (videosBy.get(c.id) ?? []).map(v => ({ v, pub: ms(v.published_at) })).filter((x): x is { v: VideoRow; pub: number } => x.pub != null).sort((a, b) => b.pub - a.pub)
    const nTracked = Math.min(vs.length, limit)
    const state = deriveSyncState({ ...c, tracked: nTracked }, now)
    let lastIdx: number | null = null
    vs.forEach(({ v, pub }, k) => {
      const fmt: Fmt = v.is_short ? 'short' : 'long'
      // D13: the video's own last check; without one, the channel's last good sync; without both, never checked
      const pinnedAt = ms(v.pinned_at), lastCheck = ms(v.last_checked_at) ?? ms(c.last_ok_synced_at)
      // the instant of a record is its real taken_at (any rate / elapsed-time math needs it: a read at 14:40 is not a
      // read at 12:00). The nominal 12:00 SP of the snap_date is only the day label and the fallback for a row without a
      // usable taken_at (missing, unparseable, or outside its own SP day).
      const series: SeriesPoint[] = (dailyBy.get(v.id) ?? []).map(d => {
        const idx = dayIndex(d.snap_date), nominal = snap0 + idx * DAY
        return { idx, t: realReadAt(d, spDateStart(d.snap_date)) ?? nominal, views: Number(d.views) }
      })
        .sort((a, b) => a.idx - b.idx)
      for (const p of series) if (lastIdx == null || p.idx > lastIdx) lastIdx = p.idx
      const realTitles: TitleVersion[] = (versionsBy.get(v.id + '|title') ?? []).map(r => ({ ...baseOf(r), text: r.value_text ?? '' }))
      let titles = withLegacy<TitleVersion>(legacyBy.get(v.id + '|title') ?? [], realTitles, pub, now, l => ({ text: l.old_title ?? '' }), l => ({ text: l.new_title ?? '' }), (l, r) => r.text === (l.new_title ?? ''))
      if (!titles.length) titles = [{ id: v.id + '/title', first_seen: pub, last_seen: now, current: true, prec: 'first', window: null, text: v.title ?? '' }]
      const thumbs: ThumbVersion[] = (versionsBy.get(v.id + '|thumb') ?? []).map(r => ({ ...baseOf(r), key: r.value_hash, art: null, blobUrl: r.thumb_blob_url }))
      const realDescs: DescVersion[] = (versionsBy.get(v.id + '|desc') ?? []).map(r => {
        const hasText = r.has_text && r.value_text != null
        return { ...baseOf(r), lines: hasText ? r.value_text!.split('\n') : null, hasText }
      })
      const descs = withLegacy<DescVersion>(legacyBy.get(v.id + '|description') ?? [], realDescs, pub, now, () => ({ lines: null, hasText: false }), () => ({ lines: null, hasText: false }))
      const title = v.title ?? titles[titles.length - 1]!.text
      videos.push({
        id: v.id, ch: c.id, niche: isNiche(c.niche) ? c.niche : null, fmt, pub, ageDays: ageOf(pub, now),
        tracked: k < nTracked, pinned: v.pinned_at != null, checkedAt: ms(v.last_checked_at),
        ...(pinnedAt != null ? { pinState: k >= nTracked && (lastCheck == null || lastCheck < pinnedAt) ? 'aguardando-primeira' as const : 'ativo' as const } : {}),
        title, theme: themes.get(v.id) ?? null, formulas: formulasOf(title),
        url: fmt === 'short' ? 'https://www.youtube.com/shorts/' + v.video_id : 'https://www.youtube.com/watch?v=' + v.video_id, ytId: v.video_id, dur: v.duration_seconds,
        views: v.view_count, viewsAt: ms(v.last_checked_at) ?? ms(c.last_ok_synced_at) ?? now, likes: v.like_count, comments: v.comment_count ?? 0,
        series, firstIdx: series.length ? series[0]!.idx : null, titles, thumbs, descs,
        ...(cappedFrom != null && pub >= seriesStart && pub < cappedFrom ? { truncated: true } : {}),
      })
    })
    const snapshots: ChannelSnapshot[] = (snapsBy.get(c.id) ?? []).filter(s => s.subscriber_count != null).sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
      .map(s => ({ t: spDateStart(s.snapshot_date) + 12 * H, date: dmyOf(s.snapshot_date), subs: s.subscriber_count!, views: s.view_count ?? 0 }))
    channels.push({
      // competitor_channels has no language column: `lang` stays '' for competitors (only own channels carry `locale`).
      id: c.id, name: c.channel_name, fullName: c.channel_name, niche: isNiche(c.niche) ? c.niche : null, own: false, lang: '',
      subs: c.subscriber_count, video_limit: limit, url: 'https://www.youtube.com/channel/' + c.channel_id, handle: '', gender: 'n', color: colorOf(c.id), ini: initials(c.channel_name),
      avatar: c.thumbnail_url || null,
      sync: {
        state, last: ms(c.last_ok_synced_at), next, added: ms(c.added_at) ?? now, errorSince: ms(c.sync_error_since), msg: c.sync_error,
        backfill: state === 'backfill' ? backfillProgress({ tracked: nTracked, video_limit: limit, youtube_video_count: c.youtube_video_count }) : null,
      },
      activity: activityOf(vs.map(x => x.pub), now),
      lastIdx: state === 'backfill' ? null : lastIdx,
      snapshots,
    })
  }

  const ownVideosBy = groupBy(rows.ownVideos, v => v.channel_id)
  for (const oc of rows.ownChannels) {
    const ownNiche: Niche | null = isNiche(oc.niche) ? oc.niche : null
    const vs = (ownVideosBy.get(oc.id) ?? []).map(v => ({ v, pub: ms(v.published_at) })).filter((x): x is { v: OwnVideoRow; pub: number } => x.pub != null).sort((a, b) => b.pub - a.pub)
    const last = ms(oc.last_synced_at) // null = never synced: no date is invented
    vs.forEach(({ v, pub }, k) => {
      const fmt: Fmt = ownIsShort(v) ? 'short' : 'long'
      videos.push({
        id: v.id, ch: oc.id, niche: ownNiche, fmt, pub, ageDays: ageOf(pub, now), tracked: k < RULES.videoLimitMax, pinned: false,
        title: v.title, theme: themes.get(v.id) ?? null, formulas: formulasOf(v.title),
        url: fmt === 'short' ? 'https://www.youtube.com/shorts/' + v.youtube_video_id : 'https://www.youtube.com/watch?v=' + v.youtube_video_id, ytId: v.youtube_video_id, dur: v.duration_seconds,
        views: v.view_count, viewsAt: ms(v.updated_at) ?? last ?? now, likes: v.like_count, comments: v.comment_count,
        // own videos have no daily record and no versions: the engine treats them as "sem série"
        series: [], firstIdx: null, titles: [{ id: v.id + '/title', first_seen: pub, last_seen: now, current: true, prec: 'first', window: null, text: v.title }], thumbs: [], descs: [],
      })
    })
    channels.push({
      id: oc.id, name: oc.name, fullName: oc.name, niche: ownNiche, own: true, lang: oc.locale ?? '', subs: oc.subscriber_count, video_limit: RULES.videoLimitMax,
      url: 'https://www.youtube.com/channel/' + oc.channel_id, handle: oc.handle, gender: 'n', color: OWN_COLOR, ini: initials(oc.name),
      avatar: oc.thumbnail_url || null,
      sync: { state: 'ok', last, next, added: ms(oc.created_at) ?? last, errorSince: null, msg: null, backfill: null },
      activity: activityOf(vs.map(x => x.pub), now), lastIdx: null, snapshots: [],
    })
  }

  const readingOfTask = new Map(rows.readings.filter(r => r.task_id).map(r => [r.task_id!, r.id]))
  const okSyncs = rows.channels.map(c => ms(c.last_ok_synced_at)).filter((x): x is number => x != null)
  const added = rows.channels.map(c => ms(c.added_at)).filter((x): x is number => x != null)
  return {
    now, seriesStart, snap0, dailyCappedFrom: cappedFrom, obsStart: added.length ? Math.min(...added) : seriesStart,
    channels, videos, niches,
    sync: { last: okSyncs.length ? Math.max(...okSyncs) : null, next },
    readings: rows.readings.map(r => toReading(r, known)).filter((x): x is FrozenReading => x != null),
    // a published request points at the reading it produced (competitor_readings.task_id): "leitura nova às HH:MM"
    requests: orderRequests(rows.tasks.map(t => taskRowToRequest(t, ms(rows.heartbeat?.last_poll_at), now, known)).filter((x): x is ForjaRequest => x != null)
      .map(q => { const rid = readingOfTask.get(q.id); return rid ? { ...q, readingId: rid } : q }), forjaOrder(niches)),
    queue: { lastPollAt: ms(rows.heartbeat?.last_poll_at), tickMinutes: FORJA_TICK_MINUTES, capabilities: rows.heartbeat?.capabilities ?? [] },
  }
}

/**
 * The queue order the screens list requests in (dados.js requestScenario): the one the machine holds (running), then the
 * waiting ones, then the finished; same instant → IA before Viagem (the order a Todos ask splits in: `order`, the forja's);
 * then id. Never the rows' uuid order, which put "Viagem … (atrás do de IA)" before IA.
 */
const RANK: Record<string, number> = { running: 0, pending: 1 }
export function orderRequests(rs: ForjaRequest[], order: readonly Niche[] = forjaOrder(BUILTIN_NICHES)): ForjaRequest[] {
  const NICHE_ORDER: Record<string, number> = Object.fromEntries(order.map((n, i) => [n, i]))
  return [...rs].sort((a, b) => (RANK[a.status ?? ''] ?? 2) - (RANK[b.status ?? ''] ?? 2) || a.createdAt - b.createdAt
    || (NICHE_ORDER[a.niche] ?? order.length) - (NICHE_ORDER[b.niche] ?? order.length) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** Shape check for the frozen `base` (the same fields frozenOf has always required). */
function isReadingBase(b: unknown): b is ReadingBase {
  return isRecord(b) && Array.isArray(b.videos) && Array.isArray(b.channels) && typeof b.asOf === 'number' && (typeof b.windowDays === 'number' || b.windowDays === null)
    && b.videos.every(v => isRecord(v) && typeof v.id === 'string' && typeof v.ch === 'string' && typeof v.mult === 'number' && typeof v.weak === 'boolean')
}

/** The since() data frozen in `sent` (forja/sent.ts SentPack), shape-checked; a malformed piece is left out, never guessed. */
function frozenOf(sent: Record<string, unknown>): Pick<FrozenReading, 'base' | 'effects' | 'viewsThen'> {
  const out: Pick<FrozenReading, 'base' | 'effects' | 'viewsThen'> = {}
  const b = sent.base
  if (isReadingBase(b)) out.base = b
  if (Array.isArray(sent.effects) && sent.effects.every(e => isRecord(e) && typeof e.change === 'string' && typeof e.status === 'string')) out.effects = sent.effects as ReadingEffect[]
  if (typeof sent.viewsThen === 'number' || sent.viewsThen === null) out.viewsThen = sent.viewsThen as number | null
  return out
}

/** `known` = os slugs dos nichos do site (padrão: os de fábrica). Leitura de um nicho fora da lista fica sem nicho. */
export function toReading(r: ReadingRow, known: ReadonlySet<string> = BUILTIN_IDS): FrozenReading | null {
  const generatedAt = ms(r.generated_at)
  if (generatedAt == null) return null
  const niche = nicheIn(known)(r.niche) ? r.niche : null, fmt = isFmt(r.fmt) ? r.fmt : null
  const sent = isRecord(r.sent) ? r.sent : {}, text = isRecord(r.text) ? r.text : {}
  const asOf = typeof sent.asOf === 'number' ? sent.asOf : ms(typeof sent.asOf === 'string' ? sent.asOf : null) ?? generatedAt
  return {
    id: r.id, type: r.task_type, niche, fmt,
    target: r.video_id ? { kind: 'video', ...(niche ? { niche } : {}), video: r.video_id, ...(fmt ? { fmt } : {}) } : { kind: 'niche', ...(niche ? { niche } : {}), ...(fmt ? { fmt } : {}) },
    // The seal's final wording (with the window) is Task 32's; until P4 no screen renders readings.
    seal: 'forja · ' + r.model + ' · ' + r.task_type, generatedAt, model: r.model,
    sent: { ...sent, text: typeof sent.text === 'string' ? sent.text : '', asOf },
    analysis: isRecord(r.analysis) ? r.analysis : {},
    // what "Desde então" compares with, frozen inside `sent` by buildSent (absent on an older row: since() says so)
    ...frozenOf(sent),
    text: {
      ...(typeof text.title === 'string' ? { title: text.title } : {}), lead: typeof text.lead === 'string' ? text.lead : '',
      items: Array.isArray(text.items) ? text.items.filter((x): x is string => typeof x === 'string') : [],
      ...(typeof text.theme === 'string' ? { theme: text.theme } : {}),
    },
  }
}

/**
 * THE task row → request mapper (the loader and services/forja-queue both use it). The state comes from requestStateOf (forja/states.ts) — the same rule the queue service
 * plans with: a pending row is 'atrasado', 'sem máquina' (no poll for > 3 ticks, or waiting > 24 h), 'nova tentativa'
 * or 'liberado pelo vigia' from its attempts, released_at and the heartbeat, never always 'na fila'; 'stale' is 'falhou'.
 */
const KNOWN_STATUS = new Set(['pending', 'running', 'completed', 'failed', 'stale', 'refused'])
/** `known` = os slugs dos nichos do site (padrão: os de fábrica). Tarefa de um nicho fora da lista não vira pedido. */
export function taskRowToRequest(t: TaskRow, lastPollAt: number | null, now: number, known: ReadonlySet<string> = BUILTIN_IDS): ForjaRequest | null {
  const createdAt = ms(t.requested_at)
  if (!KNOWN_STATUS.has(t.status) || createdAt == null || !nicheIn(known)(t.target_niche) || !(OBS_TASK_TYPES as readonly string[]).includes(t.task_type)) return null
  const fmt = isFmt(t.target_fmt) ? t.target_fmt : undefined
  return {
    id: t.id, type: t.task_type, niche: t.target_niche, status: t.status, video: t.target_video_id,
    target: t.target_video_id ? { kind: 'video', niche: t.target_niche, video: t.target_video_id, ...(fmt ? { fmt } : {}) } : { kind: 'niche', niche: t.target_niche, ...(fmt ? { fmt } : {}) },
    state: requestStateOf(t, { lastPollAt }, now), createdAt, claimedAt: ms(t.started_at), startedAt: ms(t.started_at), publishedAt: ms(t.completed_at),
    failedAt: ms(t.failed_at) ?? ms(t.refused_at), refusedAt: ms(t.refused_at), releasedAt: ms(t.released_at),
    attempt: t.retry_count + 1, refusedReason: t.refused_reason, readingId: null,
    // R65: the stored reason of a final failure drives the engine's failure sentence (never "(sem código)" when there is one)
    failReason: (t.status === 'failed' || t.status === 'stale') && t.error_message ? t.error_message : null,
  }
}

/* ------------------------------------------------------------------ DB reads */
interface PgErr { message: string; code?: string }
interface RangeQuery { range(from: number, to: number): PromiseLike<{ data: unknown; error: PgErr | null }> }
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
const OWN_CHANNEL_COLS = 'id, channel_id, name, handle, subscriber_count, last_synced_at, locale, created_at, thumbnail_url'
/** Postgres 42703 (undefined_column) / PostgREST PGRST204: a migration do nicho ainda não chegou a este banco. */
const NO_COLUMN = new Set(['42703', 'PGRST204'])
/** Lê os canais próprios. Se a coluna `niche` ainda não existe neste banco (42703 / PGRST204), relê sem ela: todo canal carrega "sem nicho". Outro erro é lançado. */
export async function readOwnChannels(sb: SupabaseClient, siteId: string): Promise<OwnChannelRow[]> {
  const read = (cols: string) => readAll<OwnChannelRow>('youtube_channels', () => sb.from('youtube_channels').select(cols).eq('site_id', siteId).order('id'))
  try { return await read(OWN_CHANNEL_COLS + ', niche') }
  catch (e) {
    if (e instanceof ObservatoryLoadError && e.table === 'youtube_channels' && e.code != null && NO_COLUMN.has(e.code)) return read(OWN_CHANNEL_COLS)
    throw e
  }
}
/** Runs `fn` over `items` with at most `limit` in flight; results keep the input order. Rejects on the first failure. */
export async function mapLimit<A, B>(items: readonly A[], limit: number, fn: (a: A) => Promise<B>): Promise<B[]> {
  const out = new Array<B>(items.length)
  let next = 0
  const worker = async () => { for (let i = next++; i < items.length; i = next++) out[i] = await fn(items[i]!) }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}
/** `in()` chunks of one table are read in parallel (≤ IN_CHUNK_CONCURRENCY at a time): one logical pass, not a sequential crawl. */
async function readIn<T>(table: string, ids: readonly string[], build: (chunk: string[]) => RangeQuery): Promise<T[]> {
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) chunks.push(ids.slice(i, i + IN_CHUNK))
  return (await mapLimit(chunks, IN_CHUNK_CONCURRENCY, chunk => readAll<T>(table, () => build(chunk)))).flat()
}
/** Ids of the videos the engine marks `tracked`: per channel, the `video_limit` most recent by `published_at` (same rule as rowsToDataset). */
export function trackedVideoIds(channels: readonly Pick<ChannelRow, 'id' | 'video_limit'>[], videos: readonly Pick<VideoRow, 'id' | 'competitor_channel_id' | 'published_at'>[]): string[] {
  const by = groupBy(videos, v => v.competitor_channel_id), out: string[] = []
  for (const c of channels) {
    const limit = Math.min(c.video_limit, RULES.videoLimitMax)
    const dated = (by.get(c.id) ?? []).map(v => ({ id: v.id, pub: ms(v.published_at) })).filter((x): x is { id: string; pub: number } => x.pub != null).sort((a, b) => b.pub - a.pub)
    for (const x of dated.slice(0, limit)) out.push(x.id)
  }
  return out
}
/**
 * Ids whose daily record is read: the tracked ones ∪ the pinned ones (R119). A pinned video without published_at, or of a
 * channel that was not loaded, stays out: it is not in the dataset either.
 */
export function observedVideoIds(channels: readonly Pick<ChannelRow, 'id' | 'video_limit'>[], videos: readonly Pick<VideoRow, 'id' | 'competitor_channel_id' | 'published_at' | 'pinned_at'>[]): string[] {
  const out = new Set(trackedVideoIds(channels, videos)), loaded = new Set(channels.map(c => c.id))
  for (const v of videos) if (v.pinned_at != null && loaded.has(v.competitor_channel_id) && ms(v.published_at) != null) out.add(v.id)
  return [...out]
}
/**
 * The competitor videos of the given channels. A missing column (pinned_at before its migration reached this database)
 * THROWS ObservatoryLoadError: there is deliberately no reread without it, a pin must never read as "not pinned".
 */
export async function readVideos(sb: SupabaseClient, channelIds: readonly string[]): Promise<VideoRow[]> {
  return readIn<VideoRow>('competitor_videos', channelIds, ids => sb.from('competitor_videos').select(VIDEO_COLS).in('competitor_channel_id', ids).order('id'))
}
/** First SP date of the daily read: one day before the series start (the day-0 baseline), never older than DAILY_MAX_DAYS. */
export function dailyReadFrom(seriesStart: number, now: number): string { return spDate(Math.max(seriesStart - DAY, now - DAILY_MAX_DAYS * DAY)) }

/** SP midnight of the daily read start when the lookback cap cut into the series (seriesStart − 1 d older than the cap); else null. */
export function dailyCappedFrom(seriesStart: number, now: number): number | null {
  return seriesStart - DAY < now - DAILY_MAX_DAYS * DAY ? spDateStart(dailyReadFrom(seriesStart, now)) : null
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

  const [channels, ownChannels, ownVideos, legacyChanges, readings, tasks, heartbeats, niches] = await Promise.all([
    readAll<ChannelRow>('competitor_channels', () => sb.from('competitor_channels').select(CHANNEL_COLS).eq('site_id', siteId).order('id')),
    readOwnChannels(sb, siteId),
    readAll<OwnVideoRow>('youtube_videos', () => sb.from('youtube_videos').select(OWN_VIDEO_COLS).eq('site_id', siteId).eq('is_hidden', false).order('id')),
    readAll<LegacyChangeRow>('competitor_changes', () => sb.from('competitor_changes').select('id, video_id, change_type, old_title, new_title, detected_at')
      .eq('site_id', siteId).is('from_version_id', null).in('change_type', ['title', 'description']).order('id')),
    readAll<ReadingRow>('competitor_readings', () => sb.from('competitor_readings').select('id, task_id, task_type, niche, video_id, fmt, model, generated_at, sent, analysis, text, evidence')
      .eq('site_id', siteId).gte('generated_at', new Date(now - READING_DAYS * DAY).toISOString()).order('id')),
    readAll<TaskRow>('youtube_intelligence_tasks', () => sb.from('youtube_intelligence_tasks').select(TASK_COLS)
      .eq('site_id', siteId).in('task_type', [...OBS_TASK_TYPES]).gte('requested_at', new Date(now - TASK_DAYS * DAY).toISOString()).order('id')),
    readAll<HeartbeatRow>('forja_heartbeat', () => sb.from('forja_heartbeat').select('last_poll_at, capabilities').eq('site_id', siteId).order('site_id')),
    // tabela ausente (a migration ainda não chegou a este banco) → null: valem os dois de fábrica; outro erro é lançado
    readNiches(sb, siteId),
  ])
  const channelIds = channels.map(c => c.id)
  const [videos, snapshots] = await Promise.all([
    readVideos(sb, channelIds),
    readIn<SnapshotRow>('competitor_channel_snapshots', channelIds, ids => sb.from('competitor_channel_snapshots').select('id, competitor_channel_id, snapshot_date, subscriber_count, view_count, video_count')
      .in('competitor_channel_id', ids).gte('snapshot_date', spDate(now - SNAPSHOT_DAYS * DAY)).order('id')),
  ])
  const videoIds = videos.map(v => v.id)
  // daily points only for OBSERVED videos (tracked ∪ pinned; the engine ignores the series of the others), from dailyReadFrom to today (SP)
  const dailyIds = observedVideoIds(channels, videos), dailyFrom = dailyReadFrom(seriesStart, now), dailyTo = spDate(now)
  const [versions, daily] = await Promise.all([
    readIn<VersionRow>('competitor_video_versions', videoIds, ids => sb.from('competitor_video_versions').select(VERSION_COLS).in('video_id', ids).order('id')),
    readIn<DailyRow>('competitor_video_daily', dailyIds, ids => sb.from('competitor_video_daily').select('video_id, snap_date, views, likes, comments, taken_at')
      .in('video_id', ids).gte('snap_date', dailyFrom).lte('snap_date', dailyTo).order('video_id').order('snap_date')),
  ])
  return { settings, channels, ownChannels, videos, ownVideos, versions, legacyChanges, daily, snapshots, readings, tasks, heartbeat: heartbeats[0] ?? null, niches }
}

export async function loadDataset(opts: LoadOptions): Promise<Dataset> {
  return rowsToDataset(await loadRows(opts), opts.now)
}
