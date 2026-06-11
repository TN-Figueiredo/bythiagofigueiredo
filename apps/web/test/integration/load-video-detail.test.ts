import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { loadVideoDetail } from '@/lib/pipeline/load-video-detail'

/**
 * Verifies the `content_pipeline ⋈ youtube_videos` join exposed by
 * `loadVideoDetail` — the single source of A/B publish CTA facts (§3.8).
 *
 * Adapted to the REAL loader signature `(id, siteId)`, which resolves its own
 * service client via `getSupabaseServiceClient()` (the editor page depends on
 * this 2-arg shape). The join key is the real `content_pipeline.youtube_video_id`
 * uuid FK → `youtube_videos.id`, surfacing `thumbnail_hq_url` + `duration_seconds`.
 */
describe.skipIf(skipIfNoLocalDb())('loadVideoDetail join', () => {
  let siteId: string
  let pipeId: string
  let ytId: string
  let channelId: string

  beforeAll(async () => {
    const admin = getSupabaseServiceClient()

    // Seed an isolated site: youtube_channels enforces UNIQUE (site_id, locale)
    // and content_pipeline has a partial-unique title index — sharing the
    // master site collides with parallel test files and previous runs.
    const seededSite = await seedSite(admin)
    siteId = seededSite.siteId

    // youtube_videos requires a channel_id FK — create a channel for this site.
    // Schema columns (20260507000001): external id is `channel_id`; `locale`,
    // `handle`, `name`, `uploads_playlist_id` are NOT NULL.
    channelId = randomUUID()
    const { error: chErr } = await admin.from('youtube_channels').insert({
      id: channelId,
      site_id: siteId,
      channel_id: `ext-chan-${channelId.slice(0, 8)}`,
      locale: 'pt',
      handle: `@t-${channelId.slice(0, 8)}`,
      name: 'T channel',
      uploads_playlist_id: `UU-${channelId.slice(0, 8)}`,
    })
    if (chErr) throw new Error(`channel seed failed: ${chErr.message}`)

    ytId = randomUUID()
    const { error: vidErr } = await admin.from('youtube_videos').insert({
      id: ytId,
      site_id: siteId,
      channel_id: channelId,
      youtube_video_id: `ext-${ytId.slice(0, 8)}`,
      title: 'V',
      duration_seconds: 300,
      thumbnail_hq_url: 'https://x/t.jpg',
      published_at: new Date().toISOString(),
    })
    if (vidErr) throw new Error(`video seed failed: ${vidErr.message}`)

    pipeId = randomUUID()
    await admin.from('content_pipeline').insert({
      id: pipeId,
      site_id: siteId,
      format: 'video',
      stage: 'idea',
      language: 'pt-br',
      code: `vid-detail-join-${pipeId.slice(0, 8)}`,
      title_pt: 'Olá',
      youtube_video_id: ytId,
      version: 1,
      sections: {},
    })
  })

  afterAll(async () => {
    const admin = getSupabaseServiceClient()
    await admin.from('content_pipeline').delete().eq('site_id', siteId)
    if (ytId) await admin.from('youtube_videos').delete().eq('id', ytId)
    if (channelId) await admin.from('youtube_channels').delete().eq('id', channelId)
    if (siteId) await admin.from('sites').delete().eq('id', siteId)
  })

  it('returns the referenced youtube_videos thumbnail/duration via the join', async () => {
    const d = await loadVideoDetail(pipeId, siteId)
    expect(d).not.toBeNull()
    expect(d!.abJoinFacts.youtubeVideoId).toBe(ytId)
    expect(d!.abJoinFacts.thumbnailHqUrl).toBe('https://x/t.jpg')
    expect(d!.abJoinFacts.durationSeconds).toBe(300)
  })

  it('returns null abJoinFacts thumbnail/duration when no linked video', async () => {
    const admin = getSupabaseServiceClient()
    const unlinked = randomUUID()
    await admin.from('content_pipeline').insert({
      id: unlinked,
      site_id: siteId,
      format: 'video',
      stage: 'idea',
      language: 'pt-br',
      code: `vid-detail-unlinked-${unlinked.slice(0, 8)}`,
      title_pt: 'B',
      youtube_video_id: null,
      version: 1,
      sections: {},
    })
    const d = await loadVideoDetail(unlinked, siteId)
    expect(d).not.toBeNull()
    expect(d!.abJoinFacts.youtubeVideoId).toBeNull()
    expect(d!.abJoinFacts.thumbnailHqUrl).toBeNull()
    expect(d!.abJoinFacts.durationSeconds).toBeNull()
  })
})
