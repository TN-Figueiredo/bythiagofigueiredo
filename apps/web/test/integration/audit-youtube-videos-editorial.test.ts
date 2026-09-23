/**
 * DB-gated integration test for the `audit_youtube_videos_editorial` trigger
 * (migration 20260922000002).
 *
 * This suite MUST run against the real local Postgres: an in-memory double
 * executes no trigger, so it could only ever prove that the test's own fake
 * does what the test says. `HAS_LOCAL_DB=1 npx vitest run test/integration/`
 * from `apps/web`.
 *
 * The scope is the whole point. An editorial column changing has to be logged;
 * an imported metric changing has to NOT be logged; and the sync rewriting an
 * editorial column with the value it already had has to NOT be logged either
 * (Postgres fires `UPDATE OF col` on the SET list, not on a value change).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

interface AuditRow {
  id: string
  action: string
  resource_type: string
  resource_id: string
  org_id: string | null
  site_id: string | null
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown> | null
}

describe.skipIf(skipIfNoLocalDb())('audit_youtube_videos_editorial trigger', () => {
  let siteId: string
  let orgId: string
  let channelId: string
  let videoId: string

  async function auditRows(): Promise<AuditRow[]> {
    const admin = getSupabaseServiceClient()
    const { data, error } = await admin
      .from('audit_log')
      .select('id, action, resource_type, resource_id, org_id, site_id, before_data, after_data')
      .eq('resource_type', 'youtube_videos')
      .eq('resource_id', videoId)
      .order('created_at', { ascending: true })
    if (error) throw new Error(`audit_log read failed: ${error.message}`)
    return (data ?? []) as unknown as AuditRow[]
  }

  beforeAll(async () => {
    const admin = getSupabaseServiceClient()
    const seeded = await seedSite(admin)
    siteId = seeded.siteId
    orgId = seeded.orgId

    channelId = randomUUID()
    const { error: chErr } = await admin.from('youtube_channels').insert({
      id: channelId,
      site_id: siteId,
      channel_id: `ext-chan-${channelId.slice(0, 8)}`,
      locale: 'pt',
      handle: `@a-${channelId.slice(0, 8)}`,
      name: 'Audit channel',
      uploads_playlist_id: `UU-${channelId.slice(0, 8)}`,
    })
    if (chErr) throw new Error(`channel seed failed: ${chErr.message}`)

    videoId = randomUUID()
    const { error: vidErr } = await admin.from('youtube_videos').insert({
      id: videoId,
      site_id: siteId,
      channel_id: channelId,
      youtube_video_id: `ext-${videoId.slice(0, 8)}`,
      title: 'Título original',
      description: 'Descrição original',
      published_at: new Date().toISOString(),
      view_count: 100,
      is_hidden: false,
    })
    if (vidErr) throw new Error(`video seed failed: ${vidErr.message}`)
  })

  afterAll(async () => {
    const admin = getSupabaseServiceClient()
    if (videoId) await admin.from('audit_log').delete().eq('resource_type', 'youtube_videos').eq('resource_id', videoId)
    if (videoId) await admin.from('youtube_videos').delete().eq('id', videoId)
    if (channelId) await admin.from('youtube_channels').delete().eq('id', channelId)
    if (siteId) await admin.from('sites').delete().eq('id', siteId)
  })

  it('INSERT of the video wrote no audit row (discovery by the sync is not a decision)', async () => {
    expect(await auditRows()).toHaveLength(0)
  })

  it('UPDATE of an editorial column writes one audit row with before/after', async () => {
    const admin = getSupabaseServiceClient()
    const { error } = await admin
      .from('youtube_videos')
      .update({ title: 'Título novo (teste A)', updated_at: new Date().toISOString() })
      .eq('id', videoId)
    if (error) throw new Error(error.message)

    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.action).toBe('update')
    expect(rows[0]!.before_data?.title).toBe('Título original')
    expect(rows[0]!.after_data?.title).toBe('Título novo (teste A)')
  })

  it('resolves site_id and org_id, without which the ring admin could not read the row', async () => {
    // audit_log_read is `is_super_admin() OR (org_id IS NOT NULL AND
    // is_org_admin(org_id))`. A NULL org_id is an invisible audit row.
    const rows = await auditRows()
    expect(rows[0]!.site_id).toBe(siteId)
    expect(rows[0]!.org_id).toBe(orgId)
  })

  it('UPDATE of an imported metric writes NO audit row', async () => {
    const admin = getSupabaseServiceClient()
    const before = (await auditRows()).length

    const { error } = await admin
      .from('youtube_videos')
      .update({
        view_count: 999,
        like_count: 42,
        view_count_delta_today: 17,
        last_analytics_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', videoId)
    if (error) throw new Error(error.message)

    expect(await auditRows()).toHaveLength(before)
  })

  it('UPDATE rewriting an editorial column with the SAME value writes NO audit row', async () => {
    // This is every sync run: the Data API upsert always SETs title,
    // description, tags and thumbnails. `AFTER UPDATE OF` alone would fire on
    // all of them; only the WHEN clause keeps the log about real changes.
    const admin = getSupabaseServiceClient()
    const before = (await auditRows()).length

    const { error } = await admin
      .from('youtube_videos')
      .update({
        title: 'Título novo (teste A)',
        description: 'Descrição original',
        updated_at: new Date().toISOString(),
      })
      .eq('id', videoId)
    if (error) throw new Error(error.message)

    expect(await auditRows()).toHaveLength(before)
  })

  it('each editorial column is in scope on its own', async () => {
    const admin = getSupabaseServiceClient()
    const edits: Array<Record<string, unknown>> = [
      { description: 'Descrição reescrita' },
      { tags: ['bangkok', 'vlog'] },
      { thumbnail_url: 'https://i.ytimg.com/vi/x/hqdefault.jpg' },
      { thumbnail_hq_url: 'https://i.ytimg.com/vi/x/maxresdefault.jpg' },
      { title_translation: 'New title' },
      { description_translation: 'New description' },
      { is_featured: true },
      { is_hidden: true },
      { cms_notes: 'troquei a thumb em 22/09' },
      { pinned_until: new Date(Date.now() + 7 * 86400000).toISOString() },
    ]

    let expected = (await auditRows()).length
    for (const patch of edits) {
      const { error } = await admin.from('youtube_videos').update(patch).eq('id', videoId)
      if (error) throw new Error(`${Object.keys(patch)[0]}: ${error.message}`)
      expected++
      expect(
        await auditRows().then(r => r.length),
        `editing ${Object.keys(patch)[0]} should have been audited`,
      ).toBe(expected)
    }
  })
})
