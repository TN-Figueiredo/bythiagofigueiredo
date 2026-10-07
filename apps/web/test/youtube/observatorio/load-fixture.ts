// Synthetic observatory tables for the loader tests. Every date is relative to `now` (pass Date.now()): nothing here
// may be compared with a fixed calendar date.
import type { Row } from '../../helpers/fake-supabase'

const DAY = 864e5, H = 36e5
const iso = (ms: number) => new Date(ms).toISOString()
/** São Paulo calendar date (UTC−3) of an instant. */
export const spDate = (ms: number) => new Date(ms - 3 * H).toISOString().slice(0, 10)
export const ids = {
  channel: (site: string, c: number) => `${site}-ch${c}`,
  video: (site: string, c: number, v: number) => `${site}-ch${c}-v${v}`,
}
export interface FixtureOpts {
  siteId: string; now: number
  channels?: number; videosPerChannel?: number; limit?: number; days?: number
  /** false = competitor_settings without series_started_at (no daily record yet). */
  seriesStarted?: boolean
  /** Characters of each description text. */
  descChars?: number
  /** true = the OLDEST video of each channel (outside `limit`) is pinned and has a daily record like the tracked ones. */
  pinOldest?: boolean
}

/**
 * Per channel: `videosPerChannel` videos, the `limit` newest tracked with one daily record per day for `days` days.
 * Every video has one title, one thumbnail and one description version; video 0 of each channel has a SECOND
 * description version, seen one day ago, whose text adds the line "linha três".
 */
export function buildTables(o: FixtureOpts): Record<string, Row[]> {
  const s = o.siteId, now = o.now, nCh = o.channels ?? 2, nV = o.videosPerChannel ?? 4, limit = o.limit ?? 3, days = o.days ?? 5
  const pad = 'x'.repeat(Math.max(0, (o.descChars ?? 40) - 20))
  const seen = iso(now - 2 * H)
  const t: Record<string, Row[]> = {
    competitor_settings: [{ site_id: s, series_started_at: o.seriesStarted === false ? null : iso(now - days * DAY), channel_limit: 75 }],
    competitor_channels: [], competitor_videos: [], competitor_video_versions: [], competitor_video_daily: [], competitor_channel_snapshots: [],
    youtube_channels: [{ id: `${s}-own`, site_id: s, channel_id: 'UCown-' + s, name: 'Canal próprio', handle: '@proprio', subscriber_count: 500, last_synced_at: seen, locale: 'pt-BR', created_at: iso(now - 60 * DAY), niche: 'viagem', thumbnail_url: null }],
    youtube_videos: [{ id: `${s}-ownv`, site_id: s, is_hidden: false, channel_id: `${s}-own`, youtube_video_id: 'ytown-' + s, title: 'Vídeo próprio', view_count: 100, like_count: 5, comment_count: 1, duration_seconds: 500, published_at: iso(now - 3 * DAY), updated_at: seen, tags: [] }],
    competitor_changes: [], competitor_readings: [], youtube_intelligence_tasks: [],
    forja_heartbeat: [{ site_id: s, last_poll_at: iso(now - 5 * 60_000), capabilities: [] }],
    youtube_niches: [],
  }
  for (let c = 0; c < nCh; c++) {
    const ch = ids.channel(s, c)
    t.competitor_channels!.push({
      id: ch, site_id: s, channel_id: 'UC-' + ch, channel_name: 'Canal ' + c, thumbnail_url: null, subscriber_count: 1000, niche: 'viagem', video_limit: limit,
      youtube_video_count: nV, sync_status: 'idle', sync_error: null, sync_error_since: null, last_ok_synced_at: seen, last_synced_at: seen,
      full_sync_completed_at: null, added_at: iso(now - 30 * DAY + c * 1000),
    })
    for (let d = 0; d <= days; d++) t.competitor_channel_snapshots!.push({ id: `${ch}-s${d}`, competitor_channel_id: ch, snapshot_date: spDate(now - d * DAY), subscriber_count: 1000 - d, view_count: 5000, video_count: nV })
    for (let v = 0; v < nV; v++) {
      const id = ids.video(s, c, v), pub = now - (v + 1) * 2 * DAY
      const pinned = o.pinOldest === true && v === nV - 1 && v >= limit
      t.competitor_videos!.push({
        id, competitor_channel_id: ch, video_id: 'yt-' + id, title: 'Título ' + id, view_count: 1000 + v, like_count: 10, comment_count: 1, duration_seconds: 600,
        published_at: iso(pub), is_short: false, last_checked_at: seen, tags: ['viagem', 'vlog'], thumbnail_url: null, pinned_at: pinned ? iso(now - 3 * H) : null,
      })
      const base = { video_id: id, thumb_blob_url: null, first_seen_at: iso(pub + H), last_seen_at: seen, window_start: null, precision: 'first', is_current: true }
      const changed = v === 0
      t.competitor_video_versions!.push(
        { ...base, id: id + '-t1', field: 'title', value_text: 'Título ' + id, value_hash: 't1', has_text: true },
        { ...base, id: id + '-h1', field: 'thumb', value_text: null, value_hash: 'h1', has_text: false, thumb_blob_url: 'https://blob.example/' + id + '.jpg' },
        { ...base, id: id + '-d1', field: 'desc', value_text: 'linha um\nlinha dois' + pad, value_hash: 'd1', has_text: true, ...(changed ? { is_current: false, last_seen_at: iso(now - DAY) } : {}) },
      )
      if (changed) t.competitor_video_versions!.push({ ...base, id: id + '-d2', field: 'desc', value_text: 'linha um\nlinha dois' + pad + '\nlinha três', value_hash: 'd2', has_text: true, first_seen_at: iso(now - DAY), precision: 'min' })
      if (v < limit || pinned) for (let d = days; d >= 0; d--) t.competitor_video_daily!.push({ video_id: id, snap_date: spDate(now - d * DAY), views: 1000 + (days - d) * 37 + v, likes: 10, comments: 1, taken_at: iso(now - d * DAY) })
    }
  }
  return t
}
