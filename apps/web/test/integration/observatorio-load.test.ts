// @vitest-environment node
// apps/web/test/integration/observatorio-load.test.ts — loadDataset against the local DB (one query per table).
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { loadDataset } from '@/lib/youtube/observatorio/load'
import { createObservatory } from '@/lib/youtube/observatorio'

const DAY = 864e5
const spDate = (ms: number) => new Date(ms - 3 * 36e5).toISOString().slice(0, 10)

describe.skipIf(skipIfNoLocalDb())('loadDataset (local DB)', () => {
  // created in beforeAll: CI collects this file without a DB (skipIf), and the client throws without env
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const now = Date.now()
  let siteId = '', ch1 = '', ch2 = '', va = '', vb = '', vc = ''
  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    // own site: competitor_settings is one row per site, shared with other suites running in parallel
    siteId = (await seedSite(sb)).siteId
    const okAt = new Date(now - 2 * 36e5).toISOString()
    const chs = await sb.from('competitor_channels').insert([
      { site_id: siteId, channel_id: 'UCobsload1', channel_name: 'Obs Viagem', niche: 'viagem', video_limit: 1, last_ok_synced_at: okAt, last_synced_at: okAt },
      { site_id: siteId, channel_id: 'UCobsload2', channel_name: 'Obs IA', niche: 'ia', video_limit: 50, last_ok_synced_at: null },
    ]).select('id, channel_id')
    expect(chs.error).toBeNull()
    ch1 = chs.data!.find(c => c.channel_id === 'UCobsload1')!.id; ch2 = chs.data!.find(c => c.channel_id === 'UCobsload2')!.id
    const vids = await sb.from('competitor_videos').insert([
      { competitor_channel_id: ch1, video_id: 'obsloadA', title: 'I Tested 7 AI Video Tools', published_at: new Date(now - 10 * DAY).toISOString(), view_count: 900, is_short: false },
      { competitor_channel_id: ch1, video_id: 'obsloadB', title: 'Antigo', published_at: new Date(now - 40 * DAY).toISOString(), view_count: 100, is_short: false },
      { competitor_channel_id: ch2, video_id: 'obsloadC', title: 'Um Short', published_at: new Date(now - 3 * DAY).toISOString(), view_count: 50, is_short: true },
    ]).select('id, video_id')
    expect(vids.error).toBeNull()
    const id = (y: string) => vids.data!.find(v => v.video_id === y)!.id
    va = id('obsloadA'); vb = id('obsloadB'); vc = id('obsloadC')
    const seen = new Date(now - 5 * DAY).toISOString()
    expect((await sb.from('competitor_video_versions').insert([
      { video_id: va, field: 'title', value_text: 'I Tested 7 AI Video Tools', value_hash: 'h', has_text: true, first_seen_at: seen, last_seen_at: seen, precision: 'first' },
    ])).error).toBeNull()
    expect((await sb.from('competitor_video_daily').insert([
      { video_id: va, snap_date: spDate(now - 2 * DAY), views: 800, taken_at: new Date(now - 2 * DAY).toISOString() },
      { video_id: va, snap_date: spDate(now - DAY), views: 900, taken_at: new Date(now - DAY).toISOString() },
      // untracked video (over video_limit) and a point dated after today: neither may be read
      { video_id: vb, snap_date: spDate(now - DAY), views: 99, taken_at: new Date(now - DAY).toISOString() },
      { video_id: va, snap_date: spDate(now + 3 * DAY), views: 12345, taken_at: new Date(now + 3 * DAY).toISOString() },
    ])).error).toBeNull()
    expect((await sb.from('competitor_settings').upsert({ site_id: siteId, series_started_at: new Date(now - 5 * DAY).toISOString() }, { onConflict: 'site_id' })).error).toBeNull()
  })
  afterAll(async () => {
    await sb.from('competitor_channels').delete().eq('site_id', siteId)
    await sb.from('competitor_settings').delete().eq('site_id', siteId)
    await sb.from('sites').delete().eq('id', siteId)
  })

  it('maps fmt, tracked, series and niche, reading each table once', async () => {
    const spy = vi.spyOn(sb, 'from')
    const ds = await loadDataset({ siteId, now, supabase: sb })
    const tables = spy.mock.calls.map(c => c[0])
    spy.mockRestore()
    expect(tables.filter(t => t === 'competitor_videos')).toHaveLength(1)
    for (const t of ['competitor_channels', 'competitor_video_versions', 'competitor_video_daily', 'competitor_channel_snapshots', 'competitor_settings']) expect(tables.filter(x => x === t)).toHaveLength(1)

    const V = (id: string) => ds.videos.find(v => v.id === id)!
    expect(V(va)).toMatchObject({ fmt: 'long', tracked: true, niche: 'viagem', ch: ch1 })
    expect(V(vb)).toMatchObject({ fmt: 'long', tracked: false, niche: 'viagem' })
    expect(V(vc)).toMatchObject({ fmt: 'short', tracked: true, niche: 'ia', ch: ch2 })
    expect(V(va).series.map(p => p.views)).toEqual([800, 900])
    expect(V(vb).series).toEqual([]) // untracked: daily record not read
    expect(V(va).firstIdx).toBe(V(va).series[0]!.idx)
    expect(V(va).series[1]!.idx - V(va).series[0]!.idx).toBe(1)
    expect(V(va).titles.map(t => t.text)).toEqual(['I Tested 7 AI Video Tools'])

    const C = (id: string) => ds.channels.find(c => c.id === id)!
    expect(C(ch1)).toMatchObject({ niche: 'viagem', own: false })
    expect(C(ch1).sync.state).toBe('ok')
    expect(C(ch1).lastIdx).toBe(V(va).series[1]!.idx)
    expect(C(ch2).sync.state).toBe('backfill')
    expect(C(ch2).sync.backfill).toEqual({ done: 1, total: 50 })

    // P4 tables are not there yet: they read as empty, never as an error
    expect(ds.readings).toEqual([]); expect(ds.requests).toEqual([]); expect(ds.queue.lastPollAt).toBeNull()

    const obs = createObservatory(ds)
    expect(obs.integrity.ok).toBe(true)
    expect(obs.SYNC.last).not.toBeNull()
  })
})
