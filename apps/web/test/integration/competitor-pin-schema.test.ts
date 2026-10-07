// @vitest-environment node
// apps/web/test/integration/competitor-pin-schema.test.ts — colunas de fixar vídeo e a função de contagem, no banco local.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const DAY = 864e5
const spDate = (ms: number) => new Date(ms - 3 * 36e5).toISOString().slice(0, 10)

describe.skipIf(skipIfNoLocalDb())('fixar vídeo: schema e contagem (banco local)', () => {
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const now = Date.now()
  let siteId = '', otherSite = '', chId = '', v1 = '', v2 = '', v3 = ''
  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    siteId = (await seedSite(sb)).siteId
    otherSite = (await seedSite(sb)).siteId
    chId = (await sb.from('competitor_channels').insert({ site_id: siteId, channel_id: 'UCpinschema', channel_name: 'Canal Schema', video_limit: 50 }).select('id').single()).data!.id
    const vids = await sb.from('competitor_videos').insert([
      { competitor_channel_id: chId, video_id: 'pinschemaA', title: 'A', published_at: new Date(now - 5 * DAY).toISOString() },
      { competitor_channel_id: chId, video_id: 'pinschemaB', title: 'B', published_at: new Date(now - 400 * DAY).toISOString(), pinned_at: new Date(now - DAY).toISOString() },
      { competitor_channel_id: chId, video_id: 'pinschemaC', title: 'C', published_at: new Date(now - 9 * DAY).toISOString() },
    ]).select('id, video_id')
    expect(vids.error).toBeNull()
    const id = (y: string) => vids.data!.find(v => v.video_id === y)!.id
    v1 = id('pinschemaA'); v2 = id('pinschemaB'); v3 = id('pinschemaC')
    const seen = new Date(now - 2 * DAY).toISOString()
    const ver = (video_id: string, field: string) => ({ video_id, field, value_text: field === 'thumb' ? null : 'x', value_hash: 'h-' + field, has_text: field !== 'thumb', first_seen_at: seen, last_seen_at: seen, precision: 'first' })
    expect((await sb.from('competitor_video_versions').insert([ver(v1, 'title'), ver(v1, 'desc'), ver(v1, 'thumb'), ver(v2, 'title')])).error).toBeNull()
    const d = (video_id: string, ms: number) => ({ video_id, snap_date: spDate(ms), views: 10, taken_at: new Date(ms).toISOString() })
    // 3 rows on 2 distinct days
    expect((await sb.from('competitor_video_daily').insert([d(v1, now - 2 * DAY), d(v2, now - 2 * DAY), d(v1, now - DAY)])).error).toBeNull()
  })
  afterAll(async () => {
    await sb.from('competitor_channels').delete().eq('site_id', siteId)
    await sb.from('sites').delete().in('id', [siteId, otherSite])
  })

  it('pinned_at nasce nulo e o filtro "is not null" acha só o fixado', async () => {
    const all = await sb.from('competitor_videos').select('id, pinned_at, pinned_by').eq('competitor_channel_id', chId)
    expect(all.error).toBeNull()
    expect(all.data!.find(v => v.id === v1)).toMatchObject({ pinned_at: null, pinned_by: null })
    const pinned = await sb.from('competitor_videos').select('id').eq('competitor_channel_id', chId).not('pinned_at', 'is', null)
    expect(pinned.data!.map(v => v.id)).toEqual([v2])
  })

  it('pinned_by só aceita um usuário que existe', async () => {
    const bad = await sb.from('competitor_videos').update({ pinned_by: '00000000-0000-4000-8000-000000000001' }).eq('id', v3).select('id')
    expect(bad.error?.code).toBe('23503')
  })

  it('a função conta vídeos, fixados, versões e dias distintos de registro; sem troca salva, bookmarks é zero', async () => {
    const { data, error } = await sb.rpc('competitor_channel_removal_impact', { p_site_id: siteId, p_channel_id: chId })
    expect(error).toBeNull()
    expect(data).toEqual({ status: 'ok', name: 'Canal Schema', videos: 3, pinned: 1, versions: 4, daily_days: 2, bookmarks: 0 })
  })

  it('trocas salvas do canal entram na conta; as não salvas não', async () => {
    const at = new Date(now - DAY).toISOString()
    const chg = (video_id: string, bookmarked: boolean) => ({ video_id, site_id: siteId, change_type: 'title', old_title: 'a', new_title: 'b', detected_at: at, bookmarked })
    expect((await sb.from('competitor_changes').insert([chg(v1, true), chg(v2, true), chg(v3, false)])).error).toBeNull()
    const { data, error } = await sb.rpc('competitor_channel_removal_impact', { p_site_id: siteId, p_channel_id: chId })
    expect(error).toBeNull()
    expect(data).toMatchObject({ status: 'ok', bookmarks: 2 })
  })

  it('canal de outro site (ou inexistente) devolve not_found, nunca zeros', async () => {
    const { data, error } = await sb.rpc('competitor_channel_removal_impact', { p_site_id: otherSite, p_channel_id: chId })
    expect(error).toBeNull()
    expect(data).toEqual({ status: 'not_found' })
  })
})
