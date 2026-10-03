// @vitest-environment node
// apps/web/test/integration/competitor-sync-versions.test.ts
import { describe, it, expect, vi, beforeAll } from 'vitest'
import sharp from 'sharp'
import { skipIfNoLocalDb } from '../helpers/db-skip'
vi.mock('@vercel/blob', () => ({ put: vi.fn(async () => ({ url: 'https://blob.test/x.jpg' })) }))
vi.mock('@/lib/notifications/create', () => ({ createNotification: vi.fn() }))
import { syncCompetitorChannel } from '@/lib/youtube/competitor-sync'
import { hashValue } from '@/lib/youtube/competitor-versions'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const sp = (iso: string) => new Date(iso + '-03:00').toISOString()
/** Horizontal gradient, bright → dark: every dHash comparison is 1 → "ffffffffffffffff". */
async function gradient(): Promise<Buffer> {
  const w = 90, h = 80, raw = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.fill(255 - x * 2, (y * w + x) * 3, (y * w + x) * 3 + 3)
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer()
}
function apiFetch(newTitle: string, thumbBytes: Buffer): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = String(input)
    if (u.includes('/channels?')) return Response.json({ items: [{ contentDetails: { relatedPlaylists: { uploads: 'UUx' } }, snippet: { title: 'Canal' }, statistics: { subscriberCount: '1000', videoCount: '1', viewCount: '10' } }] })
    if (u.includes('/playlistItems?')) return Response.json({ items: [{ snippet: { resourceId: { videoId: 'vidsync1' } } }] })
    if (u.includes('/videos?')) return Response.json({ items: [{ id: 'vidsync1', snippet: { title: newTitle, description: 'd', publishedAt: '2026-10-20T15:00:00Z', thumbnails: { high: { url: 'https://i.ytimg.com/vi/vidsync1/hqdefault.jpg' } } }, statistics: { viewCount: '500', likeCount: '5', commentCount: '1' }, contentDetails: { duration: 'PT10M' } }] })
    if (u.includes('i.ytimg.com') && init?.method === 'HEAD') return new Response(null, { status: 200, headers: { etag: '"e2"' } })
    if (u.includes('i.ytimg.com')) return new Response(thumbBytes, { status: 200, headers: { etag: '"e2"' } })
    return new Response('unexpected ' + u, { status: 500 })
  }) as typeof fetch
}

describe.skipIf(skipIfNoLocalDb())('syncCompetitorChannel versions', () => {
  let sb: ReturnType<typeof getSupabaseServiceClient>
  beforeAll(() => { sb = getSupabaseServiceClient() })
  let siteId = '', chId = '', vidId = ''
  beforeAll(async () => {
    siteId = (await sb.from('sites').select('id').limit(1).single()).data!.id
    await sb.from('competitor_channels').delete().eq('site_id', siteId).eq('channel_id', 'UCsync')
    chId = (await sb.from('competitor_channels').insert({ site_id: siteId, channel_id: 'UCsync', channel_name: 'Canal', video_limit: 50, last_ok_synced_at: sp('2026-10-24T12:00:00'), last_synced_at: sp('2026-10-24T12:00:00') }).select('id').single()).data!.id
    vidId = (await sb.from('competitor_videos').insert({ competitor_channel_id: chId, video_id: 'vidsync1', title: 'A', published_at: '2026-10-20T15:00:00Z' }).select('id').single()).data!.id
    const seen = sp('2026-10-24T12:00:00')
    const seedRes = await sb.from('competitor_video_versions').insert([
      { video_id: vidId, field: 'title', value_text: 'A', value_hash: hashValue('A'), has_text: true, first_seen_at: seen, last_seen_at: seen, precision: 'first' },
      { video_id: vidId, field: 'desc', value_text: 'd', value_hash: hashValue('d'), has_text: true, first_seen_at: seen, last_seen_at: seen, precision: 'first' },
      { video_id: vidId, field: 'thumb', value_hash: '0000000000000000', has_text: false, thumb_etag: '"e1"', thumb_dhash: '0000000000000000', first_seen_at: seen, last_seen_at: seen, precision: 'first' },
    ])
    expect(seedRes.error).toBeNull()
    await sb.from('competitor_settings').upsert({ site_id: siteId, series_started_at: null }, { onConflict: 'site_id' })
  })

  it('records title + thumbnail changes with windows, the daily record, series start and sync health', async () => {
    const now = new Date(sp('2026-10-24T18:00:00'))
    const r = await syncCompetitorChannel({ id: chId, channel_id: 'UCsync', site_id: siteId }, 'k', { now, fetchImpl: apiFetch('B', await gradient()) })
    expect(r.changesDetected).toBe(2)
    expect(r.dailyRecorded).toBe(1)

    const { data: titles } = await sb.from('competitor_video_versions').select('value_text, is_current, precision').eq('video_id', vidId).eq('field', 'title').order('first_seen_at')
    expect(titles).toEqual([{ value_text: 'A', is_current: false, precision: 'first' }, { value_text: 'B', is_current: true, precision: '6h' }])

    const { data: chg } = await sb.from('competitor_changes').select('change_type, precision, window_start, window_end, from_version_id, to_version_id, old_title, new_title').eq('video_id', vidId).order('change_type')
    expect(chg).toHaveLength(2)
    const [thumb, title] = chg!
    expect(title).toMatchObject({ change_type: 'title', precision: '6h', old_title: 'A', new_title: 'B' })
    expect(new Date(title!.window_start!).toISOString()).toBe(sp('2026-10-24T12:00:00'))
    expect(title!.from_version_id).not.toBeNull(); expect(title!.to_version_id).not.toBeNull()
    expect(thumb).toMatchObject({ change_type: 'thumbnail' })
    expect(['6h', 'min']).toContain(thumb!.precision)

    const { data: newThumb } = await sb.from('competitor_video_versions').select('thumb_blob_url, thumb_dhash').eq('video_id', vidId).eq('field', 'thumb').eq('is_current', true).single()
    expect(newThumb).toEqual({ thumb_blob_url: 'https://blob.test/x.jpg', thumb_dhash: 'ffffffffffffffff' })

    const { data: daily } = await sb.from('competitor_video_daily').select('snap_date, views').eq('video_id', vidId)
    expect(daily).toEqual([{ snap_date: '2026-10-24', views: 500 }])

    const { data: settings } = await sb.from('competitor_settings').select('series_started_at').eq('site_id', siteId).single()
    expect(settings!.series_started_at).not.toBeNull()

    const { data: ch } = await sb.from('competitor_channels').select('last_ok_synced_at, sync_error_since, sync_status').eq('id', chId).single()
    expect(new Date(ch!.last_ok_synced_at!).toISOString()).toBe(now.toISOString())
    expect(ch).toMatchObject({ sync_error_since: null, sync_status: 'idle' })
  })
})

describe.skipIf(skipIfNoLocalDb())('apply_competitor_version_plan atomicity (R22)', () => {
  let sb: ReturnType<typeof getSupabaseServiceClient>
  beforeAll(() => { sb = getSupabaseServiceClient() })
  it('a violating change row rolls back the close and the open', async () => {
    const siteId = (await sb.from('sites').select('id').limit(1).single()).data!.id
    await sb.from('competitor_channels').delete().eq('site_id', siteId).eq('channel_id', 'UCatom')
    const chId = (await sb.from('competitor_channels').insert({ site_id: siteId, channel_id: 'UCatom', channel_name: 'C', video_limit: 50 }).select('id').single()).data!.id
    const vidId = (await sb.from('competitor_videos').insert({ competitor_channel_id: chId, video_id: 'vidatom1', title: 'A' }).select('id').single()).data!.id
    const seen = new Date().toISOString()
    const old = (await sb.from('competitor_video_versions').insert({ video_id: vidId, field: 'title', value_text: 'A', value_hash: hashValue('A'), has_text: true, first_seen_at: seen, last_seen_at: seen, precision: 'first' }).select('id').single()).data!.id

    const bad = await sb.rpc('apply_competitor_version_plan', {
      p_video_id: vidId, p_close: [old],
      p_open: [{ field: 'title', value_text: 'B', value_hash: hashValue('B'), has_text: true, first_seen_at: seen, last_seen_at: seen, precision: '6h' }],
      p_changes: [{ field: 'title', site_id: siteId, change_type: 'NOT_A_TYPE', from_version_id: old, precision: '6h', window_end: seen }],
    })
    expect(bad.error).not.toBeNull()
    const { data: rows } = await sb.from('competitor_video_versions').select('id, is_current, value_text').eq('video_id', vidId)
    expect(rows).toEqual([{ id: old, is_current: true, value_text: 'A' }]) // close rolled back, no new version

    const ok = await sb.rpc('apply_competitor_version_plan', {
      p_video_id: vidId, p_close: [old],
      p_open: [{ field: 'title', value_text: 'B', value_hash: hashValue('B'), has_text: true, first_seen_at: seen, last_seen_at: seen, precision: '6h' }],
      p_changes: [{ field: 'title', site_id: siteId, change_type: 'title', old_title: 'A', new_title: 'B', from_version_id: old, precision: '6h', window_end: seen }],
    })
    expect(ok.error).toBeNull()
    expect((ok.data as { changes: number }).changes).toBe(1)
    const { data: ch } = await sb.from('competitor_changes').select('from_version_id, to_version_id').eq('video_id', vidId).single()
    expect(ch!.from_version_id).toBe(old)
    expect(ch!.to_version_id).toBe((ok.data as { opened: { title: string } }).opened.title)
  })
})
