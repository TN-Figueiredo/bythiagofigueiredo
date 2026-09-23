// @vitest-environment node
/**
 * DB-gated integration tests for the forja intelligence queue (F0 Task 14).
 *
 * The unit suite (test/lib/pipeline/services/youtube-intelligence-service.test.ts) covers every
 * branch against an in-memory PostgREST double. A double cannot model four things a real
 * Supabase/PostgREST stack does, and this file exists to prove exactly those four:
 *
 *   1. `.single()` on zero rows returns PGRST116 (an error), not an empty result — a route that
 *      used `.single()` where the service uses `.maybeSingle()` would turn a legitimate 404 into
 *      a 500. Case 6 below.
 *   2. Real `order by` on `requested_at` / `date` / `generated_at` — the double just replays
 *      queued fixtures in call order, so it can never catch a wrong `ascending` flag. Cases 3, 4
 *      and 7.
 *   3. The `result_summary->>claimed_by` PostgREST JSON arrow filter actually matches (or
 *      doesn't) against a real JSONB column. Case 2.
 *   4. A real `.eq('source', ...)` filter actually excludes a row whose text value isn't in
 *      the allowlist — the coaching-actions.test.ts unit double hand-wires each chain link to
 *      return a fixed fixture, so it can't tell a source filter that works from one that's a
 *      no-op. Case 7.
 *   5. A partial UNIQUE index, which an in-memory double cannot model at all: case 1 proves
 *      that the second channel-level write of a source now lands as a SECOND ROW instead of
 *      overwriting the first (migration 20260922000001), and that the accumulation stays
 *      scoped to (site_id, channel_id, source).
 *
 * Run with:
 *   npm run db:start
 *   npx supabase db reset --local
 *   HAS_LOCAL_DB=1 npx vitest run test/integration/youtube-intelligence-forja.test.ts
 *
 * MUST live in test/integration/ — the CI selects DB-gated suites by path.
 *
 * ---------------------------------------------------------------------------------------------
 * Case 7 update: Task 10 (`fetchChannelCoaching` allowlist of {cowork, forja}, commit 8a1b485a)
 * landed. The production query does NOT merge/dedupe cowork+forja: it asks each allowlisted
 * source for its own newest row and merges the answers by recency, so "prefers the newer of
 * cowork/forja" falls out of ordinary recency ordering (proven in both directions below), and
 * "treats forja_retirada_* as a rollback guard" falls out of no query ever asking for that
 * source — not app-layer narrowing (the narrowing in yt-analytics-tabs.tsx only ever sees rows
 * the query already let through).
 *
 * 2026-09-22: the channel analysis now ACCUMULATES (migration 20260922000001 dropped the UNIQUE
 * from idx_youtube_intelligence_channel_dedup). That killed the invariant the read used to lean
 * on — "at most one row per source, so `.limit(2)` over both sources is exhaustive" — and case 1
 * below asserts the opposite of what it asserted before. The per-source read is what replaced
 * it, and the four-row case proves `.limit(2)` over both sources would have buried the cowork
 * analysis behind two forja rows.
 */
import { randomUUID } from 'node:crypto'
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import {
  SUPABASE_URL,
  SERVICE_KEY,
  seedSite,
  seedYoutubeChannelAndVideo,
  type YoutubeChannelLocale,
} from '../helpers/db-seed'

// fetchChannelCoaching is a 'use server' action gated by getSiteContext + requireSiteScope
// (same pattern as test/integration/waitlist-cms-actions.test.ts). Mocked at that layer only —
// the DB access underneath (getSupabaseServiceClient) is untouched and hits the real local DB.
let _mockSiteId = 'unset'
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn(async () => ({ siteId: _mockSiteId })),
}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'user-mock' } })),
}))

import {
  claimNextTask,
  submitIntelRecommendations,
  failTask,
  getIntelligenceSnapshot,
} from '@/lib/pipeline/services/youtube'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import { SYNC_WINDOW_DAYS } from '@/lib/youtube/analytics-window'
import { fetchChannelCoaching } from '../../src/app/cms/(authed)/youtube/analytics/actions'

describe.skipIf(skipIfNoLocalDb())('forja intelligence queue — against a real Supabase local DB', () => {
  const svc: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })

  const siteIds: string[] = []

  afterAll(async () => {
    if (!siteIds.length) return
    // No ON DELETE CASCADE from sites -> youtube_channels/youtube_videos (checked against
    // supabase/migrations/20260507000001_schema.sql), so children are deleted explicitly,
    // deepest first. youtube_intelligence / youtube_intelligence_tasks DO cascade from
    // site_id and channel_id, but deleting them explicitly first keeps this robust to that
    // changing later.
    await svc.from('youtube_intelligence').delete().in('site_id', siteIds)
    await svc.from('youtube_intelligence_tasks').delete().in('site_id', siteIds)
    await svc.from('youtube_video_analytics').delete().in('site_id', siteIds)
    await svc.from('youtube_videos').delete().in('site_id', siteIds)
    await svc.from('youtube_channels').delete().in('site_id', siteIds)
    await svc.from('sites').delete().in('id', siteIds)
  })

  async function freshSite(): Promise<string> {
    const { siteId } = await seedSite(svc)
    siteIds.push(siteId)
    return siteId
  }

  async function freshChannel(siteId: string): Promise<string> {
    const { channelId } = await seedYoutubeChannelAndVideo(svc, siteId)
    return channelId
  }

  /**
   * Only a channel, no video — cheaper than seedYoutubeChannelAndVideo when a video isn't needed.
   *
   * `locale` is explicit because of `youtube_channels_site_id_locale_key` UNIQUE (site_id, locale)
   * with `locale` CHECK-constrained to 'pt' | 'en': a site holds at most ONE channel per locale.
   * Two channels on the same site therefore mean one PT and one EN — which is the production
   * shape, not a workaround. A third channel needs a third site.
   */
  async function freshChannelOnly(siteId: string, locale: YoutubeChannelLocale = 'pt'): Promise<string> {
    const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
    const { data, error } = await svc
      .from('youtube_channels')
      .insert({
        site_id: siteId,
        channel_id: `UCseed${suffix}`.slice(0, 24),
        locale,
        handle: `@seed-${suffix}`,
        name: 'Seed Channel',
        uploads_playlist_id: `UUseed${suffix}`.slice(0, 24),
      })
      .select('id')
      .single()
    if (error || !data) throw new Error(`freshChannelOnly: ${error?.message}`)
    return data.id as string
  }

  async function seedTask(
    siteId: string,
    channelId: string,
    overrides: Partial<{ status: string; trigger_type: string }> = {},
  ): Promise<string> {
    const { data, error } = await svc
      .from('youtube_intelligence_tasks')
      .insert({
        site_id: siteId,
        channel_id: channelId,
        status: overrides.status ?? 'pending',
        trigger_type: overrides.trigger_type ?? 'manual',
      })
      .select('id')
      .single()
    if (error || !data) throw new Error(`seedTask: ${error?.message}`)
    return data.id as string
  }

  function forjaCtx(siteId: string, keyId: string): ServiceContext {
    return { siteId, permissions: ['read', 'intelligence'], keyId, supabase: svc, source: 'api_key' }
  }

  function readCtx(siteId: string): ServiceContext {
    return { siteId, permissions: ['read'], supabase: svc }
  }

  async function seedChannelIntelligence(
    siteId: string,
    channelId: string,
    source: 'cowork' | 'forja',
    summary: string,
  ): Promise<void> {
    const { error } = await svc.from('youtube_intelligence').insert({
      site_id: siteId,
      channel_id: channelId,
      video_id: null,
      type: 'channel',
      coaching: { summary, priorities: [] },
      source,
      generated_at: new Date().toISOString(),
    })
    if (error) throw new Error(`seedChannelIntelligence: ${error.message}`)
  }

  async function readChannelIntelligence(
    siteId: string,
    channelId: string,
    source: 'cowork' | 'forja',
  ): Promise<Array<{ id: string; generated_at: string; coaching: { summary: string } | null }>> {
    const { data, error } = await svc
      .from('youtube_intelligence')
      .select('id, generated_at, coaching')
      .eq('site_id', siteId)
      .eq('channel_id', channelId)
      .is('video_id', null)
      .eq('source', source)
    if (error) throw new Error(`readChannelIntelligence: ${error.message}`)
    return (data ?? []) as Array<{ id: string; generated_at: string; coaching: { summary: string } | null }>
  }

  const CHANNEL_ONLY_PAYLOAD = (taskId: string, summary: string) => ({
    task_id: taskId,
    coaching: { summary, priorities: [] as unknown[] },
    channel_insights: { patterns_detected: [], analysis_text: 'texto' },
  })

  function daysAgoUTC(n: number): string {
    return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
  }

  // ── Case 1 — the channel analysis ACCUMULATES (migration 20260922000001) ─────────────────

  it(
    'two forja PATCHes on the same channel (distinct tasks) leave TWO rows, oldest text intact ' +
      'and newest text added; the cowork row, another channel\'s and another site\'s stay untouched',
    async () => {
      // This asserted the exact OPPOSITE until 2026-09-22: `idx_youtube_intelligence_channel_dedup`
      // was UNIQUE (site_id, channel_id, source) WHERE video_id IS NULL and the write path did
      // read-then-update, so the second run OVERWROTE the first. One row per source, for ever:
      // no trend, and a bad run destroyed the good measurement before it. The owner decided the
      // channel analysis should accumulate like video_grade_history / playlist_snapshots /
      // competitor_channel_snapshots / content_pipeline_history already do. The in-memory double
      // cannot model a unique index at all, which is why this case has to run against Postgres.
      const siteId = await freshSite()
      const otherSiteId = await freshSite()
      // The neighbours still matter, now for the opposite reason: they prove the accumulation is
      // scoped, not a free-for-all. A second channel under the SAME site and a channel under
      // ANOTHER site must each keep exactly their own single row. The same-site pair varies the
      // locale because one site holds at most one channel per locale.
      const channelId = await freshChannelOnly(siteId, 'pt')
      const otherChannelId = await freshChannelOnly(siteId, 'en')
      const otherSiteChannelId = await freshChannelOnly(otherSiteId, 'pt')

      await seedChannelIntelligence(siteId, channelId, 'cowork', 'cowork original')
      await seedChannelIntelligence(siteId, otherChannelId, 'forja', 'forja outro canal')
      await seedChannelIntelligence(otherSiteId, otherSiteChannelId, 'forja', 'forja outro site')

      const key = `key-forja-${randomUUID()}`

      const task1 = await seedTask(siteId, channelId)
      const claim1 = await claimNextTask(forjaCtx(siteId, key), [channelId])
      expect(claim1.data?.id).toBe(task1)
      const submit1 = await submitIntelRecommendations(
        forjaCtx(siteId, key),
        CHANNEL_ONLY_PAYLOAD(task1, 'primeira'),
      )
      expect(submit1.data.status).toBe('ok')

      const task2 = await seedTask(siteId, channelId)
      const claim2 = await claimNextTask(forjaCtx(siteId, key), [channelId])
      expect(claim2.data?.id).toBe(task2)
      const submit2 = await submitIntelRecommendations(
        forjaCtx(siteId, key),
        CHANNEL_ONLY_PAYLOAD(task2, 'segunda'),
      )
      // The second run used to be impossible to distinguish from the first because it
      // overwrote it. If the UNIQUE index ever comes back, this INSERT raises 23505 and the
      // submit degrades to PARTIAL_FAILURE instead of 'ok' — the regression is loud, not silent.
      expect(submit2.data.status).toBe('ok')

      // TWO forja rows for this channel, both texts present — a series, not a slot.
      const forjaRows = await readChannelIntelligence(siteId, channelId, 'forja')
      expect(forjaRows).toHaveLength(2)
      expect(forjaRows.map(r => r.coaching?.summary).sort()).toEqual(['primeira', 'segunda'])
      // Each run carries its own timestamp: without distinct generated_at there is no
      // "most recent" to read, and the whole point of keeping the history collapses.
      expect(new Set(forjaRows.map(r => r.generated_at)).size).toBe(2)

      // Accumulation is per (site, channel, source): the neighbours keep exactly one row each,
      // and the cowork row of this very channel is untouched by the two forja runs.
      const cowork = await readChannelIntelligence(siteId, channelId, 'cowork')
      expect(cowork).toHaveLength(1)
      expect(cowork[0]?.coaching?.summary).toBe('cowork original')

      const otherChannel = await readChannelIntelligence(siteId, otherChannelId, 'forja')
      expect(otherChannel).toHaveLength(1)
      expect(otherChannel[0]?.coaching?.summary).toBe('forja outro canal')

      const otherSite = await readChannelIntelligence(otherSiteId, otherSiteChannelId, 'forja')
      expect(otherSite).toHaveLength(1)
      expect(otherSite[0]?.coaching?.summary).toBe('forja outro site')
    },
  )

  it(
    'THE CASE THAT MUST EXIST: two runs of the same source are two rows, and the read returns ' +
      'the NEWER one — the older stays readable as history',
    async () => {
      // Write and read in one test, end to end against Postgres: the write path accumulates,
      // and `fetchChannelCoaching` — whose old `.limit(COACHING_SOURCES.length)` leaned on the
      // dead "at most two rows ever" invariant — still answers with the newest per source.
      const siteId = await freshSite()
      const channelId = await freshChannelOnly(siteId)
      const key = `key-forja-${randomUUID()}`

      const task1 = await seedTask(siteId, channelId)
      await claimNextTask(forjaCtx(siteId, key), [channelId])
      await submitIntelRecommendations(forjaCtx(siteId, key), CHANNEL_ONLY_PAYLOAD(task1, 'medicao da semana 1'))

      // `generated_at` is `now()` on both submits and Postgres timestamptz is microsecond
      // resolution, but ordering must not depend on how fast the two calls happen to run.
      // Backdating the first row makes "the newer one" a fact, not a race.
      const first = await readChannelIntelligence(siteId, channelId, 'forja')
      expect(first).toHaveLength(1)
      const { error: backdateError } = await svc
        .from('youtube_intelligence')
        .update({ generated_at: new Date(Date.now() - 7 * 86_400_000).toISOString() })
        .eq('id', first[0]!.id)
      if (backdateError) throw new Error(`backdate: ${backdateError.message}`)

      const task2 = await seedTask(siteId, channelId)
      await claimNextTask(forjaCtx(siteId, key), [channelId])
      const submit2 = await submitIntelRecommendations(
        forjaCtx(siteId, key),
        CHANNEL_ONLY_PAYLOAD(task2, 'medicao da semana 2'),
      )
      expect(submit2.data.status).toBe('ok')

      // Two rows: last week's measurement was not destroyed by this week's.
      const rows = await readChannelIntelligence(siteId, channelId, 'forja')
      expect(rows).toHaveLength(2)
      expect(rows.map(r => r.coaching?.summary).sort()).toEqual([
        'medicao da semana 1',
        'medicao da semana 2',
      ])

      // And the screen reads the newer one.
      _mockSiteId = siteId
      const result = await fetchChannelCoaching(channelId)
      expect(result?.source).toBe('forja')
      expect(result?.coaching.summary).toBe('medicao da semana 2')
      // Nothing else to show: the older forja row is history, not today's cards, and no
      // cowork row exists on this channel at all.
      expect(result?.cards).toBeNull()
    },
  )

  it(
    'history on BOTH sources: the read returns the newest of each, never an older row and ' +
      'never two rows of the same source',
    async () => {
      // The precise failure mode the old query acquired the moment history became possible:
      // `.limit(2)` over `.in('source', [cowork, forja])` returns THE TWO NEWEST ROWS OVERALL.
      // With two recent forja rows it returns two forja rows and buries the cowork analysis —
      // the exact regression this suite already has a case for, resurrected by a different
      // cause. Four rows, deliberately interleaved in time so the two newest overall are both
      // forja.
      const siteId = await freshSite()
      const channelId = await freshChannelOnly(siteId)
      const now = Date.now()
      const at = (days: number) => new Date(now - days * 86_400_000).toISOString()
      const priorities = [
        { axis: 'ctr', score: 3, diagnosis: 'CTR baixo', action: 'Testar thumbnails' },
        { axis: 'retention', score: 4, diagnosis: 'Retencao baixa', action: 'Cortar a intro' },
      ]

      const { error } = await svc.from('youtube_intelligence').insert([
        { site_id: siteId, channel_id: channelId, video_id: null, type: 'channel',
          source: 'cowork', coaching: { summary: 'cowork antigo', priorities }, generated_at: at(40) },
        { site_id: siteId, channel_id: channelId, video_id: null, type: 'channel',
          source: 'cowork', coaching: { summary: 'cowork recente', priorities }, generated_at: at(20) },
        { site_id: siteId, channel_id: channelId, video_id: null, type: 'channel',
          source: 'forja', coaching: { summary: 'forja semana passada', priorities: [] }, generated_at: at(7) },
        { site_id: siteId, channel_id: channelId, video_id: null, type: 'channel',
          source: 'forja', coaching: { summary: 'forja desta semana', priorities: [] }, generated_at: at(0) },
      ])
      if (error) throw new Error(`seed four-row history: ${error.message}`)

      _mockSiteId = siteId
      const result = await fetchChannelCoaching(channelId)

      // Banner: the newest forja. Cards: the newest COWORK — not the second-newest forja,
      // which is what a `.limit(2)` over both sources would have handed back.
      expect(result?.source).toBe('forja')
      expect(result?.coaching.summary).toBe('forja desta semana')
      expect(result?.cards?.source).toBe('cowork')
      expect(result?.cards?.coaching.summary).toBe('cowork recente')
      expect(result?.cards?.coaching.priorities).toHaveLength(2)
    },
  )

  // ── Case 2 — closing CAS against the real `result_summary->>claimed_by` JSON filter ───────

  it('closing CAS: a different claimed_by writes 0 rows and 409s; the same claimed_by closes to completed', async () => {
    const siteId = await freshSite()
    const channelId = await freshChannelOnly(siteId)
    const taskId = await seedTask(siteId, channelId)

    const owner = forjaCtx(siteId, 'key-owner')
    const claimed = await claimNextTask(owner, [channelId])
    expect(claimed.data?.id).toBe(taskId)

    const { data: afterClaim } = await svc
      .from('youtube_intelligence_tasks')
      .select('status, result_summary, started_at')
      .eq('id', taskId)
      .single()
    expect(afterClaim?.status).toBe('running')
    expect((afterClaim?.result_summary as { claimed_by: string }).claimed_by).toBe('key-owner')

    const impostor = forjaCtx(siteId, 'key-impostor')
    await expect(
      submitIntelRecommendations(impostor, CHANNEL_ONLY_PAYLOAD(taskId, 'roubada')),
    ).rejects.toMatchObject({ code: 'TASK_NOT_RUNNING', status: 409 })

    // 0 rows written: the task is exactly as claimNextTask left it.
    const { data: afterImpostor } = await svc
      .from('youtube_intelligence_tasks')
      .select('status, started_at')
      .eq('id', taskId)
      .single()
    expect(afterImpostor?.status).toBe('running')
    expect(afterImpostor?.started_at).toBe(afterClaim?.started_at)

    const submit = await submitIntelRecommendations(owner, CHANNEL_ONLY_PAYLOAD(taskId, 'legitima'))
    expect(submit.data.status).toBe('ok')

    const { data: closed } = await svc
      .from('youtube_intelligence_tasks')
      .select('status')
      .eq('id', taskId)
      .single()
    expect(closed?.status).toBe('completed')
  })

  // ── Case 3 — claim scoped by channel_ids AND site_id; empty queue is 204, never 500 ───────

  it('claim with channel_ids + site_id claims only the eligible task; empty queue, a channel with no ' +
    'pending task and a channel from another site all resolve to null (204), never throw', async () => {
    const siteId = await freshSite()
    const otherSiteId = await freshSite()
    const emptySiteId = await freshSite()

    // The eligible channel and the not-pending one share a site ON PURPOSE: that is what makes
    // r1 a test of the `channel_ids`/status filter rather than of site isolation. One site holds
    // at most one channel per locale, so the pair is PT + EN.
    const eligibleChannel = await freshChannelOnly(siteId, 'pt')
    const eligibleTask = await seedTask(siteId, eligibleChannel)

    const noPendingChannel = await freshChannelOnly(siteId, 'en')
    await seedTask(siteId, noPendingChannel, { status: 'completed' })

    // The empty-queue channel gets its OWN site (siteId is full at two locales) and is queried
    // with that site's ctx — so it exercises the zero-rows branch alone. Parking it under
    // otherSiteId and claiming with siteId's ctx would silently turn it into a second copy of
    // r3 (site isolation) and stop testing the empty queue at all.
    const emptyChannel = await freshChannelOnly(emptySiteId, 'pt')
    // zero tasks at all for emptyChannel

    const otherSiteChannel = await freshChannelOnly(otherSiteId, 'pt')
    await seedTask(otherSiteId, otherSiteChannel)

    const ctx = forjaCtx(siteId, 'key-scope')

    // "channel_ids sem pending" — the row exists, in this very site, but isn't pending.
    const r1 = await claimNextTask(ctx, [noPendingChannel])
    expect(r1.data).toBeNull()

    // "fila vazia" — channel has zero rows, under its own site's ctx.
    const r2 = await claimNextTask(forjaCtx(emptySiteId, 'key-scope'), [emptyChannel])
    expect(r2.data).toBeNull()

    // "channel_ids de outro site" — the task exists, but not under this ctx.siteId.
    const r3 = await claimNextTask(ctx, [otherSiteChannel])
    expect(r3.data).toBeNull()

    // Only the truly eligible task ever transitions.
    const r4 = await claimNextTask(ctx, [eligibleChannel])
    expect(r4.data?.id).toBe(eligibleTask)

    const { data: eligibleRow } = await svc
      .from('youtube_intelligence_tasks')
      .select('status')
      .eq('id', eligibleTask)
      .single()
    expect(eligibleRow?.status).toBe('running')

    const { data: untouched } = await svc
      .from('youtube_intelligence_tasks')
      .select('status')
      .eq('site_id', otherSiteId)
      .eq('channel_id', otherSiteChannel)
      .single()
    expect(untouched?.status).toBe('pending')
  })

  // ── Case 4 — snapshot recent_window: real date boundary + cross-channel exclusion ─────────

  it('recent_window is null when the newest analytics row is 4 days old, and videos of another ' +
    'channel never leak in', async () => {
    const siteId = await freshSite()
    // Both channels stay under the SAME site: the leak this guards against is a sibling channel
    // inside the same site (the snapshot already filters by site_id, so a cross-site video would
    // prove nothing here). Same site ⇒ one PT channel and one EN channel.
    const { channelId, videoId } = await seedYoutubeChannelAndVideo(svc, siteId, { locale: 'pt' })
    const { videoId: otherVideoId } = await seedYoutubeChannelAndVideo(svc, siteId, { locale: 'en' })

    const { error: e1 } = await svc.from('youtube_video_analytics').insert({
      site_id: siteId,
      youtube_video_id: videoId,
      date: daysAgoUTC(4),
      views: 10,
      subscribers_gained: 1,
    })
    if (e1) throw new Error(`seed analytics (own video, day-4): ${e1.message}`)

    // A recent row, but on a video that belongs to a DIFFERENT channel — must not surface
    // in this channel's snapshot and must not affect its recent_window.
    const { error: e2 } = await svc.from('youtube_video_analytics').insert({
      site_id: siteId,
      youtube_video_id: otherVideoId,
      date: daysAgoUTC(1),
      views: 999,
      subscribers_gained: 99,
    })
    if (e2) throw new Error(`seed analytics (other channel, day-1): ${e2.message}`)

    const { data } = await getIntelligenceSnapshot(readCtx(siteId), channelId)

    expect(data.recent_window).toBeNull()
    expect(data.videos).toHaveLength(1)
    expect(data.videos[0]?.id).toBe(videoId)
    expect(data.videos[0]?.recent).toEqual({ views: 0, subscribers_gained: 0 })
  })

  it('recent_window is NOT null when the newest analytics row is 3 days old', async () => {
    const siteId = await freshSite()
    const { channelId, videoId } = await seedYoutubeChannelAndVideo(svc, siteId)
    const boundary = daysAgoUTC(3)

    const { error } = await svc.from('youtube_video_analytics').insert({
      site_id: siteId,
      youtube_video_id: videoId,
      date: boundary,
      views: 42,
      subscribers_gained: 3,
    })
    if (error) throw new Error(`seed analytics (day-3): ${error.message}`)

    const { data } = await getIntelligenceSnapshot(readCtx(siteId), channelId)

    expect(data.recent_window).toEqual({ date: boundary, days: SYNC_WINDOW_DAYS })
    expect(data.videos.find((v) => v.id === videoId)?.recent).toEqual({ views: 42, subscribers_gained: 3 })
  })

  // ── Case 5 — fail {retry:true} requeues to pending ─────────────────────────────────────────

  it('fail with retry:true sends the task back to pending', async () => {
    const siteId = await freshSite()
    const channelId = await freshChannelOnly(siteId)
    const taskId = await seedTask(siteId, channelId)

    const ctx = forjaCtx(siteId, 'key-retry')
    await claimNextTask(ctx, [channelId])

    const result = await failTask(ctx, taskId, { reason: 'timeout', retry: true })
    expect(result.data.status).toBe('pending')
    expect(result.data.retry_count).toBe(1)

    const { data: row } = await svc
      .from('youtube_intelligence_tasks')
      .select('status, started_at, error_message, retry_count')
      .eq('id', taskId)
      .single()
    expect(row?.status).toBe('pending')
    expect(row?.started_at).toBeNull()
    expect(row?.error_message).toBeNull()
    expect(row?.retry_count).toBe(1)
  })

  // ── Case 6 — PGRST116 proof: nonexistent / cross-site task_id is 404, never 500 ───────────

  it('PATCH (submitIntelRecommendations) with a nonexistent or cross-site task_id 404s, never 500s', async () => {
    const siteId = await freshSite()
    const otherSiteId = await freshSite()
    const otherSiteChannel = await freshChannelOnly(otherSiteId)
    const otherSiteTask = await seedTask(otherSiteId, otherSiteChannel)

    const ctx = forjaCtx(siteId, 'key-404')

    await expect(
      submitIntelRecommendations(ctx, CHANNEL_ONLY_PAYLOAD(randomUUID(), 'x')),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 })

    await expect(
      submitIntelRecommendations(ctx, CHANNEL_ONLY_PAYLOAD(otherSiteTask, 'x')),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 })
  })

  it('fail with a nonexistent or cross-site task_id 404s, never 500s', async () => {
    const siteId = await freshSite()
    const otherSiteId = await freshSite()
    const otherSiteChannel = await freshChannelOnly(otherSiteId)
    const otherSiteTask = await seedTask(otherSiteId, otherSiteChannel)

    const ctx = forjaCtx(siteId, 'key-404')

    await expect(
      failTask(ctx, randomUUID(), { reason: 'x' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 })

    await expect(
      failTask(ctx, otherSiteTask, { reason: 'x' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 })
  })

  // ── Case 7 — fetchChannelCoaching: real generated_at ordering + real .in() allowlist ──────

  it(
    'returns whichever of cowork/forja carries the newer generated_at — proven in both ' +
      'directions, against real timestamptz ordering',
    async () => {
      const siteId = await freshSite()
      // One PT + one EN channel under the same site (max one channel per locale) so both
      // directions run in a single test without a third site.
      const channelForjaWins = await freshChannelOnly(siteId, 'pt')
      const channelCoworkWins = await freshChannelOnly(siteId, 'en')
      const now = Date.now()
      const daysAgoISO = (n: number) => new Date(now - n * 86_400_000).toISOString()

      const { error } = await svc.from('youtube_intelligence').insert([
        {
          site_id: siteId, channel_id: channelForjaWins, video_id: null, type: 'channel',
          source: 'cowork', coaching: { summary: 'forjaWins: cowork velho', priorities: [] },
          generated_at: daysAgoISO(3),
        },
        {
          site_id: siteId, channel_id: channelForjaWins, video_id: null, type: 'channel',
          source: 'forja', coaching: { summary: 'forjaWins: forja novo', priorities: [] },
          generated_at: daysAgoISO(1),
        },
        {
          site_id: siteId, channel_id: channelCoworkWins, video_id: null, type: 'channel',
          source: 'forja', coaching: { summary: 'coworkWins: forja velho', priorities: [] },
          generated_at: daysAgoISO(3),
        },
        {
          site_id: siteId, channel_id: channelCoworkWins, video_id: null, type: 'channel',
          source: 'cowork', coaching: { summary: 'coworkWins: cowork novo', priorities: [] },
          generated_at: daysAgoISO(1),
        },
      ])
      if (error) throw new Error(`seed cowork/forja pairs: ${error.message}`)

      _mockSiteId = siteId

      const resultForjaWins = await fetchChannelCoaching(channelForjaWins)
      expect(resultForjaWins?.source).toBe('forja')
      expect(resultForjaWins?.coaching.summary).toBe('forjaWins: forja novo')

      const resultCoworkWins = await fetchChannelCoaching(channelCoworkWins)
      expect(resultCoworkWins?.source).toBe('cowork')
      expect(resultCoworkWins?.coaching.summary).toBe('coworkWins: cowork novo')
    },
  )

  it(
    'THE REGRESSION: the newest row is a forja summary with priorities:[] and the older cowork ' +
      'row has six — one read returns both, the banner is the forja, the cards are the cowork',
    async () => {
      // Production, 2026-09-22: the forja wrote its first channel row and `.limit(1)` buried
      // the May analysis. Only a real Postgres proves the two rows come back in one read and
      // in the right order — the unit double replays whatever it is handed.
      const siteId = await freshSite()
      const channelId = await freshChannelOnly(siteId)
      const now = Date.now()

      const priorities = [
        { axis: 'ctr', score: 3, diagnosis: 'CTR baixo', action: 'Testar thumbnails' },
        { axis: 'retention', score: 4, diagnosis: 'Retencao baixa', action: 'Cortar a intro' },
      ]
      const { error } = await svc.from('youtube_intelligence').insert([
        {
          site_id: siteId, channel_id: channelId, video_id: null, type: 'channel',
          source: 'cowork',
          coaching: { summary: 'analise de maio', priorities },
          generated_at: new Date(now - 120 * 86_400_000).toISOString(),
        },
        {
          site_id: siteId, channel_id: channelId, video_id: null, type: 'channel',
          source: 'forja',
          coaching: { summary: 'resumo da forja', priorities: [] },
          generated_at: new Date(now).toISOString(),
        },
      ])
      if (error) throw new Error(`seed forja-over-cowork pair: ${error.message}`)

      _mockSiteId = siteId
      const result = await fetchChannelCoaching(channelId)

      expect(result?.source).toBe('forja')
      expect(result?.coaching.summary).toBe('resumo da forja')
      expect(result?.cards?.source).toBe('cowork')
      expect(result?.cards?.coaching.summary).toBe('analise de maio')
      expect(result?.cards?.coaching.priorities).toHaveLength(2)
    },
  )

  it(
    'a forja_retirada_* row is excluded by the source allowlist even when it is the newest row ' +
      '— the older cowork row wins as the rollback guard, not app-layer narrowing',
    async () => {
      const siteId = await freshSite()
      const channelId = await freshChannelOnly(siteId)
      const now = Date.now()

      // Since migration 20260922000001 the channel index is no longer UNIQUE, so any number
      // of rows coexist under the same channel regardless of source — 'cowork' and
      // 'forja_retirada_202609181200' included. What keeps the retirada row off the screen is
      // the query, which never asks for a source outside the allowlist.
      const { error } = await svc.from('youtube_intelligence').insert([
        {
          site_id: siteId, channel_id: channelId, video_id: null, type: 'channel',
          source: 'cowork', coaching: { summary: 'cowork antes da retirada', priorities: [] },
          generated_at: new Date(now - 2 * 86_400_000).toISOString(),
        },
        {
          site_id: siteId, channel_id: channelId, video_id: null, type: 'channel',
          source: 'forja_retirada_202609181200',
          coaching: { summary: 'retirada — nunca deveria ser lido', priorities: [] },
          generated_at: new Date(now).toISOString(),
        },
      ])
      if (error) throw new Error(`seed retirada row: ${error.message}`)

      _mockSiteId = siteId
      const result = await fetchChannelCoaching(channelId)
      expect(result?.source).toBe('cowork')
      expect(result?.coaching.summary).toBe('cowork antes da retirada')
    },
  )

  // ── Per-series numbers survive the round trip (2026-09-22) ──────────────────────────────

  it(
    'the per-series numbers and the examined-without-verdict series reach the jsonb column ' +
      'INTACT — nothing stripped, nothing rounded',
    async () => {
      // Why this runs against Postgres and not the double: the loss this guards is Zod's STRIP.
      // The schema is z.object() without .strict(), so a field it doesn't declare is dropped in
      // silence on the way to the insert — no error anywhere. Only reading the row back proves the
      // declared fields are the ones that land. Values are the real channel's (snapshot of
      // 2026-09-22): 0–10 at 91 against a cohort of 143,5 — reconstructing 143,5 from the
      // rounded "0,63×" gives 144,4, which is why the exact numbers have to travel.
      const siteId = await freshSite()
      const channelId = await freshChannelOnly(siteId)
      const key = `key-forja-${randomUUID()}`
      const taskId = await seedTask(siteId, channelId)
      const claim = await claimNextTask(forjaCtx(siteId, key), [channelId])
      expect(claim.data?.id).toBe(taskId)

      const episodios = [randomUUID(), randomUUID(), randomUUID()]
      const padrao = {
        tipo: 'padrao',
        pattern_id: 'serie:zero-dez',
        category: 'series',
        finding: 'Série "0–10": 11 vídeos, mediana de 91 views na vida (0,63× da coorte de 2019)',
        confidence: 0.6,
        sample_size: 10,
        serie: 'zero-dez',
        nome: '0–10',
        n: 11,
        ano: 2019,
        anos: { de: 2017, ate: 2019 },
        periodo: { de: '2017-11-02', ate: '2019-06-14' },
        mediana: 91,
        mediana_coorte: 143.5,
        n_coorte: 10,
        razao: 0.6341463414634146,
        leitura: 'abaixo',
        episodios,
      }
      const semCoorte = {
        tipo: 'examinada',
        serie: 'canada',
        nome: 'Canadá',
        n: 9,
        ano: 2018,
        anos: { de: 2017, ate: 2019 },
        periodo: { de: '2017-08-01', ate: '2019-02-10' },
        mediana: 120,
        n_coorte: 2,
        leitura: 'sem_coorte',
        motivo: 'coorte_fina',
        episodios: [randomUUID()],
      }
      const neutra = {
        tipo: 'examinada',
        serie: 'vlogzeira',
        nome: 'Vlogzeira',
        n: 3,
        ano: 2018,
        anos: { de: 2018, ate: 2018 },
        periodo: { de: '2018-01-05', ate: '2018-04-20' },
        mediana: 213,
        mediana_coorte: 150,
        n_coorte: 5,
        razao: 1.42,
        leitura: 'neutra',
        motivo: 'padrao_neutro',
        episodios: [randomUUID()],
      }
      // An old-shape pattern (no `tipo`, none of the new fields) still goes through untouched:
      // the rows already in production look like this and must keep validating.
      const antigo = {
        pattern_id: 'legado', category: 'series', finding: 'achado antigo', confidence: 0.5, sample_size: 4,
      }

      const submit = await submitIntelRecommendations(forjaCtx(siteId, key), {
        task_id: taskId,
        coaching: { summary: 'resumo', priorities: [] },
        channel_insights: { patterns_detected: [padrao, semCoorte, neutra, antigo], analysis_text: 'texto' },
      })
      expect(submit.data.status).toBe('ok')

      const { data, error } = await svc
        .from('youtube_intelligence')
        .select('patterns_detected')
        .eq('site_id', siteId)
        .eq('channel_id', channelId)
        .is('video_id', null)
        .eq('source', 'forja')
      if (error) throw new Error(`read back: ${error.message}`)
      expect(data).toHaveLength(1)
      const lidos = data?.[0]?.patterns_detected as Array<Record<string, unknown>>

      // Whole-object equality, in order: a single stripped field or a rounded number fails here.
      expect(lidos).toEqual([padrao, semCoorte, neutra, antigo])
      // And the two numbers the screen needs, spelled out so a failure names them.
      expect(lidos[0]?.mediana).toBe(91)
      expect(lidos[0]?.mediana_coorte).toBe(143.5)
      expect(lidos[0]?.razao).toBe(0.6341463414634146)
      expect(lidos[0]?.anos).toEqual({ de: 2017, ate: 2019 })
      expect(lidos[0]?.episodios).toEqual(episodios)
      expect(lidos.filter(p => p.tipo === 'examinada').map(p => [p.serie, p.leitura, p.motivo])).toEqual([
        ['canada', 'sem_coorte', 'coorte_fina'],
        ['vlogzeira', 'neutra', 'padrao_neutro'],
      ])
    },
  )
})
