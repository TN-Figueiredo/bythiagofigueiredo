/**
 * Fidelity seed: the approved mockup's ORACLE dataset (test/fixtures/observatorio/dados.cjs) → rows of the local DB.
 * The round trip DB → loadDataset → engine must give the mockup's numbers (tabCounts('todos') = 14/18/11).
 *
 * Mapping (DB ← oracle):
 *  - competitor_settings: series_started_at = SERIES_START, channel_limit = opts.channelLimit ?? 75;
 *  - competitor_channels: sync columns derived from sync.state (erro → sync_status 'error' + the oracle message, which
 *    humanizeSyncError turns into the oracle label; atrasado → last_ok_synced_at = sync.last; backfill → never an OK
 *    sync, youtube_video_count = backfill.total so the progress is tracked/total);
 *  - competitor_videos + competitor_video_daily (snap_date = SP date of the 12:00 snapshot of each index);
 *  - competitor_video_versions from titles/thumbs/descs (thumbnail: value_hash = the oracle key, thumb_blob_url = null;
 *    'publicacao'/'desde-arquivo' → precision 'first');
 *  - competitor_changes: pre-series TITLE changes as legacy rows (from_version_id null — what production has from before
 *    the series), every other change with its version ids (the loader ignores those; they mirror production);
 *  - competitor_channel_snapshots; the own channel as youtube_channels + youtube_videos (no series: production has none);
 *  - competitor_readings (model 'Gemma 12B'; oracle ids inside are rewritten to the seeded uuids; the latest `temas`
 *    reading per niche carries the video → theme evidence the loader reads);
 *  - youtube_intelligence_tasks: the oracle's history requests always; with opts.forjaState, also the requests of
 *    O.forja.requestScenario(state, { niche: 'todos', type }) (columns as requestStateOf reads them);
 *  - forja_heartbeat: the oracle's last poll, or the scenario machine's when opts.forjaState is set.
 *
 * Ids are deterministic (uuid from siteId + oracle id), so a screen URL is stable across seeds.
 * Safety: refuses any Supabase URL that is not local — apps/web/.env.local points at PRODUCTION.
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { RequestState } from '../../src/lib/youtube/observatorio/types'

export interface SeedOptions {
  /** A request state of the forja (P4 screens): writes the scenario's requests and machine. */
  forjaState?: RequestState | null
  /** task_type of the scenario requests (default 'padroes-titulo'). */
  forjaType?: string
  channelLimit?: number
  /** The own channel without a long video in the last 90 days (the mockup's 'own-empty' scenario). */
  ownEmpty?: boolean
  /** Only the competitor channels whose sync is not ok ("Só canais com problema"). */
  onlyProblems?: boolean
  /**
   * Not a data state: the mockup's empty windows ("Janela sem outliers", "Vazio em 90 dias") are FILTERS over the same
   * data. Put them in MockupState.query. Passing true throws, so a spec never believes it seeded an empty window.
   */
  emptyWindow?: boolean
  /** Named mockup scenario: only 'own-empty' (= ownEmpty) exists in the oracle. */
  scenario?: string
}

/** The mockup clock (dados.js NOW_ISO). Also the webServer's OBS_NOW_OVERRIDE. */
export const ORACLE_NOW_ISO = '2026-10-24T15:02:00-03:00'
export const ORACLE_NOW = Date.parse(ORACLE_NOW_ISO)

/* ------------------------------------------------------------------ oracle shapes (only what the seed reads) */
type OPrec = 'publicacao' | 'desde-arquivo' | 'min' | '6h' | '1d'
interface OVersion { id: string; first_seen: number; last_seen: number; current: boolean; prec: OPrec; window: [number, number] | null }
interface OTitle extends OVersion { text: string }
interface OThumb extends OVersion { key: string }
interface ODesc extends OVersion { lines: string[] | null; hasText: boolean }
interface OSync { state: 'ok' | 'atrasado' | 'erro' | 'backfill'; last: number | null; msg: string | null; errorSince: number | null; added: number | null; backfill: { done: number; total: number } | null }
interface OChannel { id: string; name: string; niche: 'viagem' | 'ia'; own: boolean; lang: string; subs: number; video_limit: number; handle: string; sync: OSync; snapshots: Array<{ date: string; subs: number; views: number }> }
interface OVideo {
  id: string; ch: string; fmt: 'long' | 'short'; pub: number; ageDays: number; dur: string; ytId: string; title: string; theme: string | null
  views: number | null; viewsAt: number | null; likes: number | null; comments: number | null
  series: Array<{ idx: number; t: number; views: number }>; titles: OTitle[]; thumbs: OThumb[]; descs: ODesc[]
}
interface ORequest {
  id: string; scenario?: boolean; type: string; niche: 'viagem' | 'ia'; status: string; attempt?: number
  target: { kind: 'niche' | 'video'; video?: string; fmt?: 'long' | 'short' }
  createdAt: number; claimedAt: number | null; publishedAt: number | null; releasedAt?: number | null; releasedBy?: string | null
  failedAt?: number | null; refusedAt?: number | null; refusedReason?: string | null; failReason?: string | null
}
interface OReading { id: string; type: string; niche: 'viagem' | 'ia'; fmt?: 'long' | 'short'; target?: { kind: string; video?: string }; generatedAt: number; sent: unknown; analysis: unknown; text: unknown }
interface OracleData {
  NOW: number; SERIES_START: number; OBS_START: number
  channels: OChannel[]; videos: OVideo[]
  forja: {
    readings: OReading[]; requests: ORequest[]; queue: { lastPollAt: number }
    requestScenario(state: string, target: { niche: string; type: string }): { requests: ORequest[]; machine: { lastPollAt: number | null } } | null
  }
}

/**
 * Same as test/youtube/observatorio/oracle.ts loadOracle(), which cannot be imported here: it locates the fixture with
 * import.meta.url, and Playwright compiles this package (no "type": "module") to CommonJS, where import.meta is a
 * SyntaxError. __dirname works under both Playwright and Vitest.
 */
function loadOracleData(): OracleData {
  const ctx: Record<string, unknown> = { console: { log() {}, error() {} } }
  vm.createContext(ctx)
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../test/fixtures/observatorio/dados.cjs'), 'utf8'), ctx)
  return ctx.OBS as OracleData
}

/* ------------------------------------------------------------------ helpers */
const DAY = 864e5, SP_OFF = 3 * 36e5
const iso = (ms: number | null | undefined): string | null => (ms == null ? null : new Date(ms).toISOString())
const spDate = (ms: number) => new Date(ms - SP_OFF).toISOString().slice(0, 10)
const sha1 = (s: string) => createHash('sha1').update(s).digest('hex')
/** Deterministic uuid (v5 layout) for an oracle id within a site. */
export function seedUuid(siteId: string, kind: string, oracleId: string): string {
  const h = sha1(siteId + '|' + kind + '|' + oracleId)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16]!, 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`
}
const durSeconds = (dur: string) => dur.split(':').map(Number).reduce((acc, n) => acc * 60 + n, 0)
const precOf = (p: OPrec): 'first' | 'min' | '6h' | '1d' => (p === 'publicacao' || p === 'desde-arquivo' ? 'first' : p)
const FIELD_OF = { title: 'title', description: 'desc', thumbnail: 'thumb' } as const
const changePrec = (p: OPrec): 'min' | '6h' | '1d' | null => (p === 'min' || p === '6h' || p === '1d' ? p : null)
const dmyToIso = (d: string) => { const [dd, mm, yyyy] = d.split('/'); return `${yyyy}-${mm}-${dd}` }

/** Throws unless the Supabase URL is the local stack (127.0.0.1 / localhost). */
export function assertLocal(url: string): void {
  const host = new URL(url).hostname
  if (host !== '127.0.0.1' && host !== 'localhost') throw new Error('observatorio-seed: refusing a non-local Supabase (' + host + ')')
}
/** Service client of the LOCAL Supabase (env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). */
export function localServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('observatorio-seed: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing (apps/web/.env.test)')
  assertLocal(url)
  return createClient(url, key, { auth: { persistSession: false } })
}
function clientOf(sb?: SupabaseClient): SupabaseClient {
  if (!sb) return localServiceClient()
  // supabaseUrl is public on the client: the guard holds for an injected client too
  const url = (sb as unknown as { supabaseUrl?: string }).supabaseUrl
  // fail closed: a client whose URL cannot be read is refused rather than trusted
  if (typeof url !== 'string' || !url) throw new Error('observatorio-seed: cannot read the injected client URL; refusing to write')
  assertLocal(url)
  return sb
}

async function insertAll(sb: SupabaseClient, table: string, rows: object[], chunk = 1000): Promise<void> {
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await sb.from(table).insert(rows.slice(i, i + chunk))
    if (error) throw new Error('observatorio-seed: insert ' + table + ' failed: ' + error.message)
  }
}
async function check(label: string, p: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
  const { error } = await p
  if (error) throw new Error('observatorio-seed: ' + label + ' failed: ' + error.message)
}

/** Rewrites every string equal to an oracle video/channel id into its seeded uuid (readings carry oracle ids). */
function remapIds(x: unknown, ids: Map<string, string>): unknown {
  if (typeof x === 'string') return ids.get(x) ?? x
  if (Array.isArray(x)) return x.map(y => remapIds(y, ids))
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, remapIds(v, ids)]))
  return x
}

/* ------------------------------------------------------------------ clear */
/**
 * Removes the observatory data of the site, not only what the seed wrote: every competitor channel (and, by cascade,
 * videos, versions, daily rows, snapshots), changes, readings, heartbeat, settings, and EVERY non-diagnostico forja
 * task of the site (including one a developer queued by hand). Fine for the local e2e site; never point it elsewhere
 * (clientOf refuses non-local URLs).
 */
export async function clearObservatory(siteId: string, client?: SupabaseClient): Promise<void> {
  const sb = clientOf(client)
  const ownId = seedUuid(siteId, 'own-channel', 'own')
  await check('delete competitor_readings', sb.from('competitor_readings').delete().eq('site_id', siteId))
  await check('delete tasks', sb.from('youtube_intelligence_tasks').delete().eq('site_id', siteId).neq('task_type', 'diagnostico'))
  await check('delete forja_heartbeat', sb.from('forja_heartbeat').delete().eq('site_id', siteId))
  await check('delete competitor_changes', sb.from('competitor_changes').delete().eq('site_id', siteId))
  // cascades: competitor_videos → versions, daily; snapshots
  await check('delete competitor_channels', sb.from('competitor_channels').delete().eq('site_id', siteId))
  await check('delete competitor_settings', sb.from('competitor_settings').delete().eq('site_id', siteId))
  await check('delete youtube_videos', sb.from('youtube_videos').delete().eq('site_id', siteId).eq('channel_id', ownId))
  await check('delete youtube_channels', sb.from('youtube_channels').delete().eq('id', ownId))
}

/* ------------------------------------------------------------------ seed */
export async function seedObservatory(siteId: string, opts: SeedOptions = {}, client?: SupabaseClient): Promise<void> {
  if (opts.emptyWindow) throw new Error('observatorio-seed: emptyWindow is a filter, not data — use MockupState.query')
  if (opts.scenario && opts.scenario !== 'own-empty') throw new Error('observatorio-seed: unknown scenario ' + JSON.stringify(opts.scenario))
  const ownEmpty = !!opts.ownEmpty || opts.scenario === 'own-empty'
  const sb = clientOf(client)
  await clearObservatory(siteId, sb)

  const O = loadOracleData()
  const SS = O.SERIES_START
  const U = (kind: string, id: string) => seedUuid(siteId, kind, id)
  const ownCh = O.channels.find(c => c.own)!
  const competitors = O.channels.filter(c => !c.own && (!opts.onlyProblems || c.sync.state !== 'ok'))
  const keptCh = new Set(competitors.map(c => c.id))
  const ownVideos = O.videos.filter(v => v.ch === ownCh.id && !(ownEmpty && v.fmt === 'long' && v.ageDays <= 90))
  const compVideos = O.videos.filter(v => keptCh.has(v.ch))
  const ids = new Map<string, string>()
  for (const c of competitors) ids.set(c.id, U('channel', c.id))
  ids.set(ownCh.id, U('own-channel', 'own'))
  for (const v of compVideos) ids.set(v.id, U('video', v.id))
  for (const v of ownVideos) ids.set(v.id, U('own-video', v.id))

  await check('competitor_settings', sb.from('competitor_settings').upsert(
    { site_id: siteId, series_started_at: iso(SS), channel_limit: opts.channelLimit ?? 75 }, { onConflict: 'site_id' }))

  /* channels */
  await insertAll(sb, 'competitor_channels', competitors.map(c => {
    const s = c.sync, ok = s.state !== 'backfill'
    return {
      id: ids.get(c.id), site_id: siteId, channel_id: 'UC' + sha1(c.id).slice(0, 22), channel_name: c.name, niche: c.niche,
      subscriber_count: c.subs, video_limit: c.video_limit, thumbnail_url: null,
      sync_status: s.state === 'erro' ? 'error' : 'idle',
      // the oracle message: humanizeSyncError(msg) is the oracle's label (404 → 'não encontrado no YouTube (404)')
      sync_error: s.state === 'erro' || s.state === 'atrasado' ? s.msg : null,
      sync_error_since: s.state === 'erro' ? iso(s.errorSince) : null,
      last_ok_synced_at: ok ? iso(s.last) : null, last_synced_at: iso(s.last), full_sync_completed_at: ok ? iso(s.last) : null,
      youtube_video_count: s.backfill ? s.backfill.total : null,
      added_at: iso(s.added ?? O.OBS_START),
    }
  }))

  /* videos, daily, versions, changes */
  const videoRows: object[] = [], dailyRows: object[] = [], versionRows: object[] = [], changeRows: object[] = []
  for (const v of compVideos) {
    const vid = ids.get(v.id)!
    videoRows.push({
      id: vid, competitor_channel_id: ids.get(v.ch), video_id: v.ytId, title: v.title, view_count: v.views, like_count: v.likes,
      comment_count: v.comments, duration_seconds: durSeconds(v.dur), published_at: iso(v.pub), is_short: v.fmt === 'short',
      last_checked_at: iso(v.viewsAt), tags: [], thumbnail_url: null,
    })
    for (const p of v.series) dailyRows.push({ video_id: vid, snap_date: spDate(p.t), views: p.views, taken_at: iso(p.t) })
    const versionRow = (field: 'title' | 'thumb' | 'desc', x: OVersion, value: { value_text: string | null; value_hash: string; has_text: boolean }) => ({
      id: U('version', v.id + '/' + field + '/' + x.id), video_id: vid, field, ...value, thumb_blob_url: null,
      first_seen_at: iso(x.first_seen), last_seen_at: iso(x.last_seen), window_start: iso(x.window?.[0]), precision: precOf(x.prec), is_current: x.current,
    })
    const changeRow = (type: 'title' | 'description' | 'thumbnail', prev: OVersion | null, x: OVersion, extra: object) => ({
      site_id: siteId, video_id: vid, change_type: type, detected_at: iso(x.first_seen), ...extra,
      ...(prev ? { from_version_id: U('version', v.id + '/' + FIELD_OF[type] + '/' + prev.id), to_version_id: U('version', v.id + '/' + FIELD_OF[type] + '/' + x.id),
        window_start: iso(x.window?.[0]), window_end: iso(x.window?.[1]), precision: changePrec(x.prec) } : {}),
    })
    // titles: pre-series changes → legacy rows; real versions from the last pre-series one on
    let k = 0
    v.titles.forEach((t, i) => { if (i > 0 && t.first_seen < SS) k = i })
    for (let i = 1; i <= k; i++) changeRows.push(changeRow('title', null, v.titles[i]!, { old_title: v.titles[i - 1]!.text, new_title: v.titles[i]!.text }))
    v.titles.slice(k).forEach((t, j) => {
      versionRows.push(versionRow('title', t, { value_text: t.text, value_hash: sha1(t.text), has_text: true }))
      const i = k + j
      if (i > 0 && j > 0) changeRows.push(changeRow('title', v.titles[i - 1]!, t, { old_title: v.titles[i - 1]!.text, new_title: t.text }))
    })
    v.thumbs.forEach((t, i) => {
      versionRows.push(versionRow('thumb', t, { value_text: null, value_hash: t.key, has_text: false }))
      if (i > 0 && t.first_seen >= SS) changeRows.push(changeRow('thumbnail', v.thumbs[i - 1]!, t, {}))
    })
    v.descs.forEach((d, i) => {
      const text = d.hasText && d.lines ? d.lines.join('\n') : null
      versionRows.push(versionRow('desc', d, { value_text: text, value_hash: text != null ? sha1(text) : 'sem-texto:' + d.id, has_text: text != null }))
      if (i > 0) changeRows.push(changeRow('description', v.descs[i - 1]!, d, {}))
    })
  }
  await insertAll(sb, 'competitor_videos', videoRows)
  await insertAll(sb, 'competitor_video_versions', versionRows, 2000)
  await insertAll(sb, 'competitor_video_daily', dailyRows, 2000)
  await insertAll(sb, 'competitor_changes', changeRows)

  /* channel snapshots */
  const snapRows: object[] = []
  for (const c of competitors) {
    const seen = new Set<string>()
    for (const s of c.snapshots) {
      const date = dmyToIso(s.date)
      if (seen.has(date)) continue
      seen.add(date)
      snapRows.push({ competitor_channel_id: ids.get(c.id), snapshot_date: date, subscriber_count: s.subs, view_count: s.views })
    }
  }
  await insertAll(sb, 'competitor_channel_snapshots', snapRows, 2000)

  /* own channel (no series, no versions: production keeps neither for it) */
  const ownId = ids.get(ownCh.id)!
  await check('youtube_channels', sb.from('youtube_channels').insert({
    id: ownId, site_id: siteId, channel_id: 'UC' + sha1('own|' + ownCh.id).slice(0, 22), handle: ownCh.handle, locale: ownCh.lang === 'en' ? 'en' : 'pt',
    name: ownCh.name, uploads_playlist_id: 'UU' + sha1('own|' + ownCh.id).slice(0, 22), subscriber_count: ownCh.subs,
    last_synced_at: iso(ownCh.sync.last), created_at: iso(ownCh.sync.added ?? O.OBS_START),
  }))
  await insertAll(sb, 'youtube_videos', ownVideos.map(v => ({
    id: ids.get(v.id), site_id: siteId, channel_id: ownId, youtube_video_id: v.ytId, title: v.title, published_at: iso(v.pub),
    view_count: v.views ?? 0, like_count: v.likes ?? 0, comment_count: v.comments ?? 0, duration_seconds: durSeconds(v.dur),
    updated_at: iso(v.viewsAt ?? O.NOW), tags: [],
  })))

  /* readings: oracle ids → seeded uuids; the latest temas reading per niche carries the theme evidence */
  const latestTemas = new Map<string, OReading>()
  for (const r of O.forja.readings) if (r.type === 'temas' && (latestTemas.get(r.niche)?.generatedAt ?? -1) < r.generatedAt) latestTemas.set(r.niche, r)
  const nicheOfVideo = (v: OVideo) => O.channels.find(c => c.id === v.ch)!.niche
  await insertAll(sb, 'competitor_readings', O.forja.readings.map(r => ({
    id: U('reading', r.id), site_id: siteId, task_type: r.type, niche: r.niche, fmt: r.fmt ?? null,
    video_id: r.target?.video ? ids.get(r.target.video) ?? null : null, model: 'Gemma 12B', generated_at: iso(r.generatedAt),
    sent: remapIds(r.sent, ids), analysis: remapIds(r.analysis, ids), text: r.text,
    evidence: latestTemas.get(r.niche) === r
      ? [...compVideos, ...ownVideos].filter(v => v.theme && nicheOfVideo(v) === r.niche).map(v => ({ id: ids.get(v.id), theme: v.theme }))
      : [],
  })))

  /* forja: history requests always; the scenario's on top when asked */
  let machinePoll: number | null = O.forja.queue.lastPollAt
  const reqs: ORequest[] = O.forja.requests.filter(r => !r.scenario)
  if (opts.forjaState) {
    const sc = O.forja.requestScenario(opts.forjaState, { niche: 'todos', type: opts.forjaType ?? 'padroes-titulo' })
    if (!sc) throw new Error('observatorio-seed: unknown forja state ' + JSON.stringify(opts.forjaState))
    reqs.push(...sc.requests)
    machinePoll = sc.machine.lastPollAt
  }
  await insertAll(sb, 'youtube_intelligence_tasks', reqs.map(r => {
    // R27: released_at is the VIGIA's release; a validator rejection is a failure (failed_at) that sends it back
    const byVigia = r.releasedBy === 'vigia', byValidator = r.releasedBy === 'validador'
    return {
      id: U('task', r.id), site_id: siteId, trigger_type: 'manual', channel_id: null,
      task_type: r.type, target_niche: r.niche, target_video_id: r.type === 'leitura-video' && r.target.video ? ids.get(r.target.video) ?? null : null,
      target_fmt: r.target.fmt ?? null, status: r.status, retry_count: Math.max(0, (r.attempt ?? 1) - 1),
      requested_at: iso(r.createdAt), started_at: iso(r.claimedAt), completed_at: iso(r.publishedAt),
      failed_at: iso(r.failedAt ?? (byValidator ? r.releasedAt : null)), refused_at: iso(r.refusedAt), refused_reason: r.refusedReason ?? null,
      released_at: byVigia ? iso(r.releasedAt) : null, error_message: r.failReason ?? null,
    }
  }))
  if (machinePoll != null) {
    await check('forja_heartbeat', sb.from('forja_heartbeat').upsert(
      { site_id: siteId, last_poll_at: iso(machinePoll), capabilities: ['padroes-titulo', 'padroes-titulo-shorts', 'temas', 'resumo-trocas', 'leitura-video'] },
      { onConflict: 'site_id' }))
  }
}
