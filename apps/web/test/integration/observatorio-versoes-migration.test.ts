import { describe, it, expect, beforeAll } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

describe.skipIf(skipIfNoLocalDb())('migration observatorio_versoes', () => {
  const sb = getSupabaseServiceClient()
  let videoId = ''
  beforeAll(async () => {
    const { data: site } = await sb.from('sites').select('id').limit(1).single()
    const { data: ch } = await sb.from('competitor_channels').upsert({ site_id: site!.id, channel_id: 'UCversoes' }, { onConflict: 'site_id,channel_id' }).select('id').single()
    const { data: v } = await sb.from('competitor_videos').upsert({ competitor_channel_id: ch!.id, video_id: 'vidversoes1' }, { onConflict: 'competitor_channel_id,video_id' }).select('id').single()
    videoId = v!.id
    await sb.from('competitor_video_versions').delete().eq('video_id', videoId)
  })
  it('allows only one current version per (video, field)', async () => {
    const base = { video_id: videoId, field: 'title', value_text: 'A', value_hash: 'a', first_seen_at: new Date().toISOString(), last_seen_at: new Date().toISOString(), precision: 'first', is_current: true }
    expect((await sb.from('competitor_video_versions').insert(base)).error).toBeNull()
    const dup = await sb.from('competitor_video_versions').insert({ ...base, value_text: 'B', value_hash: 'b' })
    expect(dup.error?.message).toMatch(/duplicate|unique/i)
  })
  it('daily record is unique per (video, date)', async () => {
    const row = { video_id: videoId, snap_date: '2026-10-03', views: 10, taken_at: new Date().toISOString() }
    await sb.from('competitor_video_daily').delete().eq('video_id', videoId)
    expect((await sb.from('competitor_video_daily').insert(row)).error).toBeNull()
    expect((await sb.from('competitor_video_daily').insert(row)).error?.message).toMatch(/duplicate|unique/i)
  })
  it('competitor_changes has version and window columns', async () => {
    const { error } = await sb.from('competitor_changes').select('from_version_id, to_version_id, window_start, window_end, precision').limit(1)
    expect(error).toBeNull()
  })
})
