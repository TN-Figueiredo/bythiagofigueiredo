// @vitest-environment node
/**
 * DB-gated integration tests for the forja intelligence queue (F0 Task 14).
 *
 * The unit suite (test/lib/pipeline/services/youtube-intelligence-service.test.ts) covers every
 * branch against an in-memory PostgREST double. A double cannot model three things a real
 * Supabase/PostgREST stack does, and this file exists to prove exactly those three:
 *
 *   1. `.single()` on zero rows returns PGRST116 (an error), not an empty result — a route that
 *      used `.single()` where the service uses `.maybeSingle()` would turn a legitimate 404 into
 *      a 500. Case 6 below.
 *   2. Real `order by` on `requested_at` / `date` — the double just replays queued fixtures in
 *      call order, so it can never catch a wrong `ascending` flag. Cases 3 and 4.
 *   3. The `result_summary->>claimed_by` PostgREST JSON arrow filter actually matches (or
 *      doesn't) against a real JSONB column. Case 2.
 *
 * Run with:
 *   npm run db:start
 *   npx supabase db reset --local
 *   HAS_LOCAL_DB=1 npx vitest run test/integration/youtube-intelligence-forja.test.ts
 *
 * MUST live in test/integration/ — the CI selects DB-gated suites by path.
 *
 * ---------------------------------------------------------------------------------------------
 * DIVERGENCE FROM THE BRIEF (see final report): brief-14.md §Step 2 case 7 asks for a test of
 * `fetchChannelCoaching` merging `cowork` + `forja` rows by recency (and refusing a row whose id
 * is literally `forja_retirada_202609181200`). That merge behavior belongs to Task 10
 * (`docs/superpowers/plans/2026-09-19-forja-fila-inteligencia-plan.md:2240`), which is explicitly
 * "Gated pela Task 0" (the Health Coach mockup) and — per progress.md, Rodada 1 — still
 * "AGUARDA APROVACAO DO DONO". The function as it exists today
 * (apps/web/src/app/cms/(authed)/youtube/analytics/actions.ts:21-44) hard-filters
 * `.eq('source', 'cowork')` and never reads a `forja` row at all, so case 7 cannot be written as
 * a passing test against real code without first implementing Task 10 — which is out of scope
 * for a test-only task and, per project rule, requires visual approval before any code lands.
 * Left as `it.todo` below with the same explanation, instead of silently dropped or faked green.
 */
import { randomUUID } from 'node:crypto'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import {
  SUPABASE_URL,
  SERVICE_KEY,
  seedSite,
  seedYoutubeChannelAndVideo,
  type YoutubeChannelLocale,
} from '../helpers/db-seed'
import {
  claimNextTask,
  submitIntelRecommendations,
  failTask,
  getIntelligenceSnapshot,
} from '@/lib/pipeline/services/youtube'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import { SYNC_WINDOW_DAYS } from '@/lib/youtube/analytics-window'

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
  ): Promise<Array<{ id: string; coaching: { summary: string } | null }>> {
    const { data, error } = await svc
      .from('youtube_intelligence')
      .select('id, coaching')
      .eq('site_id', siteId)
      .eq('channel_id', channelId)
      .is('video_id', null)
      .eq('source', source)
    if (error) throw new Error(`readChannelIntelligence: ${error.message}`)
    return (data ?? []) as Array<{ id: string; coaching: { summary: string } | null }>
  }

  const CHANNEL_ONLY_PAYLOAD = (taskId: string, summary: string) => ({
    task_id: taskId,
    coaching: { summary, priorities: [] as unknown[] },
    channel_insights: { patterns_detected: [], analysis_text: 'texto' },
  })

  function daysAgoUTC(n: number): string {
    return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
  }

  // ── Case 1 — channel-row upsert dedup (idx_youtube_intelligence_channel_dedup) ────────────

  it(
    'two forja PATCHes on the same channel (distinct tasks) collapse into ONE channel row with the ' +
      'second text; the cowork row, another channel\'s forja row and another site\'s forja row stay intact',
    async () => {
      const siteId = await freshSite()
      const otherSiteId = await freshSite()
      // The dedup key is (site_id, channel_id, source) WHERE video_id IS NULL, so proving it
      // needs BOTH neighbours: a second channel under the SAME site (→ channel_id is really in
      // the key) and a channel under another site (→ site_id is really in the key). The same-site
      // pair varies the locale because one site holds at most one channel per locale.
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
      expect(submit2.data.status).toBe('ok')

      // Exactly one forja row for this channel, carrying the SECOND text — proves the
      // idx_youtube_intelligence_channel_dedup partial unique index (site_id, channel_id,
      // source WHERE video_id IS NULL) is what the update path relies on, against a real DB.
      const forjaRows = await readChannelIntelligence(siteId, channelId, 'forja')
      expect(forjaRows).toHaveLength(1)
      expect(forjaRows[0]?.coaching?.summary).toBe('segunda')

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

  // ── Case 7 — fetchChannelCoaching cowork/forja merge — BLOCKED, see file header ────────────

  it.todo(
    'fetchChannelCoaching prefers the newer of cowork/forja, falls back to cowork when forja is ' +
      'older, and treats a forja_retirada_* row as a rollback guard back to cowork ' +
      '(blocked: Task 10 not implemented yet — gated on mockup approval, see file header)',
  )
})
