// Observatório — the heavy rows of ONE channel (videos, versions, daily records, subscriber snapshots) and the
// assembly of every channel's rows with the live ones. loadRows (load.ts) reads the same tables for the whole site at
// once; test/youtube/observatorio/load-channel.test.ts keeps the two equal.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { spDateOf } from './time'
import {
  readAll, readIn, observedVideoIds, dailyReadFrom, snapshotReadFrom, VIDEO_COLS, VERSION_COLS, SNAPSHOT_COLS,
  type VideoRow, type VersionRow, type DailyRow, type SnapshotRow, type LiveRows, type ObservatoryRows,
} from './load'
import type { ChannelRows } from './pack'

const DESC_META_COLS = VERSION_COLS.split(', ').filter(c => c !== 'value_text').join(', ')
/** Only what rowsToDataset reads of a daily record. */
const DAILY_COLS = 'video_id, snap_date, views, taken_at'

/** `seriesStart` null = no daily record yet in this site (the read window then starts at `now`, as in loadRows). */
export interface ChannelLoad { channelId: string; videoLimit: number; seriesStart: number | null; now: number }

export async function loadChannelRows(sb: SupabaseClient, c: ChannelLoad): Promise<ChannelRows> {
  const seriesStart = c.seriesStart ?? c.now
  // a missing pinned_at column throws here, as in readVideos: a pin must never read as "not pinned"
  const [videos, snapshots] = await Promise.all([
    readAll<VideoRow>('competitor_videos', () => sb.from('competitor_videos').select(VIDEO_COLS).eq('competitor_channel_id', c.channelId).order('id')),
    readAll<SnapshotRow>('competitor_channel_snapshots', () => sb.from('competitor_channel_snapshots').select(SNAPSHOT_COLS)
      .eq('competitor_channel_id', c.channelId).gte('snapshot_date', snapshotReadFrom(c.now)).order('id')),
  ])
  const videoIds = videos.map(v => v.id)
  // observed = tracked ∪ pinned (R119), the same set loadRows reads
  const dailyIds = observedVideoIds([{ id: c.channelId, video_limit: c.videoLimit }], videos)
  const [plain, descMeta, daily] = await Promise.all([
    readIn<VersionRow>('competitor_video_versions', videoIds, ids => sb.from('competitor_video_versions').select(VERSION_COLS).in('video_id', ids).neq('field', 'desc').order('id')),
    readIn<Omit<VersionRow, 'value_text'>>('competitor_video_versions', videoIds, ids => sb.from('competitor_video_versions').select(DESC_META_COLS).in('video_id', ids).eq('field', 'desc').order('id')),
    readIn<DailyRow>('competitor_video_daily', dailyIds, ids => sb.from('competitor_video_daily').select(DAILY_COLS)
      .in('video_id', ids).gte('snap_date', dailyReadFrom(seriesStart, c.now)).lte('snap_date', spDateOf(c.now)).order('video_id').order('snap_date')),
  ])
  // The description text is only ever read to compare two consecutive versions (changes.ts diffLines): it is fetched
  // for the videos whose description changed, and left out for the rest (most of the bytes of a version read).
  const perVideo = new Map<string, number>()
  for (const d of descMeta) perVideo.set(d.video_id, (perVideo.get(d.video_id) ?? 0) + 1)
  const changedIds = descMeta.filter(d => (perVideo.get(d.video_id) ?? 0) > 1).map(d => d.id)
  const texts = new Map((await readIn<{ id: string; value_text: string | null }>('competitor_video_versions', changedIds, ids => sb.from('competitor_video_versions').select('id, value_text').in('id', ids).order('id'))).map(t => [t.id, t.value_text]))
  // a changed description whose text did not come is marked omitted too: rowsToDataset refuses it out loud
  const descs: VersionRow[] = descMeta.map(d => (texts.has(d.id) ? { ...d, value_text: texts.get(d.id) ?? null } : { ...d, value_text: null, text_omitted: true }))
  return { videos, versions: [...plain, ...descs], daily, snapshots }
}

/**
 * Live rows + every channel's rows → the ObservatoryRows rowsToDataset takes. A cached channel can be older than this
 * render: the date windows are applied again with this render's clock, so the result equals a fresh read.
 */
export function assembleRows(live: LiveRows, parts: readonly ChannelRows[], seriesStart: number | null, now: number): ObservatoryRows {
  const snapFrom = snapshotReadFrom(now), dailyFrom = dailyReadFrom(seriesStart ?? now, now), dailyTo = spDateOf(now)
  return {
    ...live,
    videos: parts.flatMap(p => p.videos),
    versions: parts.flatMap(p => p.versions),
    daily: parts.flatMap(p => p.daily).filter(d => d.snap_date >= dailyFrom && d.snap_date <= dailyTo),
    snapshots: parts.flatMap(p => p.snapshots).filter(s => s.snapshot_date >= snapFrom),
  }
}
