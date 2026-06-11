/**
 * DB-gated integration tests for fetchAbBriefingData
 * (apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts)
 *
 * Tests the full data-assembly path: video lookup, channel lookup, scoring,
 * and test-history aggregation. Auth is mocked at the layer that
 * fetchAbBriefingData depends on (getSiteContext + requireSiteScope), so
 * the real service-client DB queries run against local Supabase.
 *
 * Run: npm run db:start && HAS_LOCAL_DB=1 npx vitest run test/integration/ab-brainstorm.test.ts
 * CI:  skipped automatically (HAS_LOCAL_DB unset)
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

// ---------------------------------------------------------------------------
// Auth + site-context mocks
// Must be declared before the actions import so Vitest's module hoisting works.
// ---------------------------------------------------------------------------

// Mock getSiteContext — returns a well-known siteId injected per-test via a
// captured variable. fetchAbBriefingData reads siteId from this mock.
let _mockSiteId = 'unset'
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn(async () => ({
    siteId: _mockSiteId,
    orgId: 'org-mock',
    defaultLocale: 'pt-BR',
    timezone: 'America/Sao_Paulo',
  })),
}))

// Mock requireSiteScope — always returns ok: true so requireEditAccess passes.
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'user-mock' } })),
}))

// Mock @vercel/blob — not used by fetchAbBriefingData but imported at module level.
vi.mock('@vercel/blob', () => ({ put: vi.fn() }))

// Mock Sentry — not relevant to the query path but imported transitively.
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

// ---------------------------------------------------------------------------
// Import the function under test AFTER mocks are set up
// ---------------------------------------------------------------------------
import { fetchAbBriefingData } from '@/app/cms/(authed)/youtube/ab-lab/actions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

/** Returns a random youtube_video_id string (11-char YT format). */
function randomYtId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 11)
}

/**
 * Seeds a minimal youtube_channels row.
 * Returns the channel's internal UUID.
 *
 * Column names match the squashed schema (20260507000001): the external id
 * column is `channel_id`; `locale`, `handle`, `name`, `uploads_playlist_id`
 * are NOT NULL.
 */
async function seedChannel(
  siteId: string,
  opts: { name?: string; subscriberCount?: number } = {},
): Promise<string> {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 22)
  const { data, error } = await supabase
    .from('youtube_channels')
    .insert({
      site_id: siteId,
      channel_id: `UC${suffix}`,
      locale: 'pt',
      handle: `@test-${suffix.slice(0, 8)}`,
      name: opts.name ?? 'Test Channel',
      uploads_playlist_id: `UU${suffix}`,
      subscriber_count: opts.subscriberCount ?? 10_000,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seedChannel: ${error?.message}`)
  return data.id
}

/**
 * Seeds a minimal youtube_videos row linked to a channel.
 * Returns the internal video UUID.
 *
 * TODO: if youtube_videos has additional NOT-NULL columns (e.g. duration_seconds,
 * published_at) that lack defaults, add them here — check migration files.
 */
async function seedVideo(
  siteId: string,
  channelId: string,
  opts: {
    title?: string
    ctr?: number | null
    avgViewPercentage?: number | null
    lastSyncedAt?: string
    youtubeVideoId?: string
  } = {},
): Promise<{ videoId: string; youtubeVideoId: string }> {
  const youtubeVideoId = opts.youtubeVideoId ?? randomYtId()
  const { data, error } = await supabase
    .from('youtube_videos')
    .insert({
      site_id: siteId,
      channel_id: channelId,
      youtube_video_id: youtubeVideoId,
      title: opts.title ?? 'Test Video',
      published_at: new Date().toISOString(), // NOT NULL, no default
      ctr: opts.ctr ?? null,
      avg_view_percentage: opts.avgViewPercentage ?? null,
      // analytics snapshot timestamp — column is last_analytics_sync_at
      // (20260517000003_analytics_intelligence.sql), not last_synced_at.
      last_analytics_sync_at: opts.lastSyncedAt ?? new Date().toISOString(),
      duration_seconds: 300, // non-Short so AB test eligible
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seedVideo: ${error?.message}`)
  return { videoId: data.id, youtubeVideoId }
}

/**
 * Seeds a completed ab_test row for a given video.
 * Returns the test UUID.
 *
 * NOTE: ab_tests.youtube_video_id is a UUID — the INTERNAL youtube_videos.id,
 * not the 11-char YouTube Data API id.
 */
async function seedCompletedAbTest(
  siteId: string,
  youtubeVideoId: string,
  opts: {
    testType?: string
    winnerLabel?: string | null
    ctrLiftPercent?: number | null
    confidenceAtCompletion?: number | null
  } = {},
): Promise<string> {
  // Insert the test itself
  const { data: test, error: testErr } = await supabase
    .from('ab_tests')
    .insert({
      site_id: siteId,
      youtube_video_id: youtubeVideoId,
      name: `Completed test ${randomUUID().slice(0, 8)}`,
      test_type: opts.testType ?? 'thumbnail',
      status: 'completed',
      started_at: new Date(Date.now() - 7 * 86400_000).toISOString(),
      completed_at: new Date().toISOString(),
      // must satisfy ab_tests_completed_reason_check (auto_resolve,
      // manual_winner, manual_archive, max_duration, inconclusive, ...)
      completed_reason: 'auto_resolve',
      confidence_at_completion: opts.confidenceAtCompletion ?? 0.97,
      result_metadata: opts.ctrLiftPercent != null
        ? { ctr_lift_percent: opts.ctrLiftPercent }
        : null,
      config: {
        max_duration_days: 14,
        confidence_threshold: 0.95,
        burn_in_days: 2,
        auto_apply_winner: true,
        rotation_pattern: 'abba',
      },
      original_thumbnail_url: 'https://i.ytimg.com/vi/test/hqdefault.jpg',
    })
    .select('id')
    .single()
  if (testErr || !test) throw new Error(`seedCompletedAbTest: ${testErr?.message}`)

  // Optionally seed a winner variant so winner_label is populated
  if (opts.winnerLabel) {
    const { data: variant, error: varErr } = await supabase
      .from('ab_test_variants')
      .insert({
        test_id: test.id,
        label: opts.winnerLabel,
        is_original: opts.winnerLabel === 'original',
        sort_order: opts.winnerLabel === 'original' ? 0 : 1,
        blob_url: 'https://example.com/thumb.jpg',
      })
      .select('id')
      .single()
    if (varErr || !variant) throw new Error(`seedCompletedAbTest: variant insert ${varErr?.message}`)

    await supabase
      .from('ab_tests')
      .update({ winner_variant_id: variant.id })
      .eq('id', test.id)
  }

  return test.id
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe.skipIf(skipIfNoLocalDb())('fetchAbBriefingData integration', () => {
  // IDs accumulated during seed for teardown
  const createdTestIds: string[] = []
  const createdVideoIds: string[] = []
  const createdChannelIds: string[] = []
  const createdSiteIds: string[] = []

  let siteId: string

  beforeAll(async () => {
    // Reuse the first existing site — same approach as ab-tests.test.ts
    const { data: site } = await supabase
      .from('sites')
      .select('id')
      .limit(1)
      .single()
    if (!site) throw new Error('fetchAbBriefingData integration: no site found in local DB')
    siteId = site.id
    // Wire the mock siteId so requireEditAccess returns the correct scope
    _mockSiteId = siteId
  })

  /**
   * youtube_channels has UNIQUE (site_id, locale) — one channel per site per
   * locale. Each test that seeds its own channel must therefore run on a fresh
   * site (also isolates from other test files running in parallel against the
   * shared master site).
   */
  async function freshSiteScope(): Promise<string> {
    const { siteId: freshId } = await seedSite(supabase)
    createdSiteIds.push(freshId)
    siteId = freshId
    _mockSiteId = freshId
    return freshId
  }

  afterAll(async () => {
    // Clean up in reverse FK order: tests → variants (cascade) → videos → channels
    for (const testId of createdTestIds) {
      await supabase.from('ab_test_cycles').delete().eq('test_id', testId)
      await supabase.from('ab_test_variants').delete().eq('test_id', testId)
      await supabase.from('ab_tests').delete().eq('id', testId)
    }
    if (createdVideoIds.length) {
      await supabase.from('youtube_videos').delete().in('id', createdVideoIds)
    }
    if (createdChannelIds.length) {
      await supabase.from('youtube_channels').delete().in('id', createdChannelIds)
    }
    if (createdSiteIds.length) {
      await supabase.from('sites').delete().in('id', createdSiteIds)
    }
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 1 — non-existent video ID
  // ─────────────────────────────────────────────────────────────────────────

  it('returns ok: false for a non-existent video ID', async () => {
    const result = await fetchAbBriefingData(randomUUID())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/não encontrado|not found/i)
    }
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2 — valid video with full metrics
  // ─────────────────────────────────────────────────────────────────────────

  it('returns ok: true with correct AbBriefingData shape for a valid video', async () => {
    /*
     * TODO: this test requires seeded youtube_channels and youtube_videos rows.
     * If seedChannel/seedVideo fail because of missing NOT-NULL columns, inspect
     * the failing error and add the missing fields to those helpers above.
     *
     * Seed: channel → video (ctr=4.5, avg_view_percentage=42)
     * Expected shape:
     *   ok: true
     *   data.channel.name = 'Integration Channel'
     *   data.video.title = 'Integration Video'
     *   data.video.ctr = 4.5
     *   data.video.avgViewPercentage = 42
     *   data.video.score and .grade are non-null (both metrics present)
     *   data.testHistory = [] (no tests seeded yet)
     *   data.snapshotAgeHours >= 0
     */
    await freshSiteScope()
    const channelId = await seedChannel(siteId, { name: 'Integration Channel', subscriberCount: 50_000 })
    createdChannelIds.push(channelId)

    const { videoId } = await seedVideo(siteId, channelId, {
      title: 'Integration Video',
      ctr: 4.5,
      avgViewPercentage: 42,
    })
    createdVideoIds.push(videoId)

    const result = await fetchAbBriefingData(videoId)
    expect(result.ok).toBe(true)
    if (!result.ok) return // narrow type

    const { data } = result

    // Channel
    expect(data.channel.name).toBe('Integration Channel')
    expect(data.channel.subscribers).toBe(50_000)
    expect(data.channel.tier).toBeTruthy()

    // Video
    expect(data.video.title).toBe('Integration Video')
    expect(data.video.ctr).toBe(4.5)
    expect(data.video.avgViewPercentage).toBe(42)
    expect(data.video.score).not.toBeNull()
    expect(data.video.grade).not.toBeNull()

    // History (no tests seeded for this video)
    expect(Array.isArray(data.testHistory)).toBe(true)
    expect(data.testHistory).toHaveLength(0)

    // Snapshot age
    expect(data.snapshotAgeHours).toBeGreaterThanOrEqual(0)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 3 — channel not found → fallback name "Canal"
  // ─────────────────────────────────────────────────────────────────────────

  it('handles channel not found gracefully — returns fallback channel name "Canal"', async () => {
    /*
     * youtube_videos.channel_id has a NOT NULL FK to youtube_channels(id) —
     * the channel cannot be deleted (RESTRICT) nor nulled while the video
     * exists, so true orphan rows are impossible. The fallback branch in
     * fetchAbBriefingData triggers when the channel lookup — which is
     * site-scoped (.eq('site_id', siteId)) — finds nothing. Simulate that by
     * moving the channel to a different site after seeding the video.
     */
    await freshSiteScope()
    const channelId = await seedChannel(siteId, { name: 'Orphan Channel', subscriberCount: 0 })
    createdChannelIds.push(channelId)

    const { videoId } = await seedVideo(siteId, channelId, {
      title: 'Orphan Video',
      ctr: null,
      avgViewPercentage: null,
    })
    createdVideoIds.push(videoId)

    // FK sanity: deleting the channel while the video references it must fail.
    const { error: delErr } = await supabase.from('youtube_channels').delete().eq('id', channelId)
    expect(delErr).not.toBeNull()

    // Move the channel out of the briefing's site scope (fresh site avoids the
    // UNIQUE (site_id, locale) constraint).
    const { siteId: otherSiteId } = await seedSite(supabase)
    createdSiteIds.push(otherSiteId)
    const { error: moveErr } = await supabase
      .from('youtube_channels')
      .update({ site_id: otherSiteId })
      .eq('id', channelId)
    expect(moveErr).toBeNull()

    const result = await fetchAbBriefingData(videoId)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Channel invisible in scope → fallback name + zero subscribers.
    expect(result.data.channel.name).toBe('Canal')
    expect(result.data.channel.subscribers).toBe(0)
    // No metrics → score and grade should be null
    expect(result.data.video.score).toBeNull()
    expect(result.data.video.grade).toBeNull()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 4 — includes completed test history
  // ─────────────────────────────────────────────────────────────────────────

  it('includes test history from completed tests only', async () => {
    /*
     * TODO: seeds a channel, a video, then two completed ab_tests + one active
     * test. Only the two completed tests should appear in data.testHistory.
     *
     * If seedCompletedAbTest fails due to missing required columns, inspect the
     * migration for ab_tests and fill in the required fields in the helper above.
     */
    await freshSiteScope()
    const channelId = await seedChannel(siteId, { name: 'History Channel', subscriberCount: 100_000 })
    createdChannelIds.push(channelId)

    const { videoId } = await seedVideo(siteId, channelId, {
      title: 'History Video',
      ctr: 3.2,
      avgViewPercentage: 35,
    })
    createdVideoIds.push(videoId)

    // Completed test 1 — thumbnail type with winner + CTR lift
    const test1Id = await seedCompletedAbTest(siteId, videoId, {
      testType: 'thumbnail',
      winnerLabel: 'variant_b',
      ctrLiftPercent: 12.5,
      confidenceAtCompletion: 0.98,
    })
    createdTestIds.push(test1Id)

    // Completed test 2 — title type, no winner (expired)
    const test2Id = await seedCompletedAbTest(siteId, videoId, {
      testType: 'title',
      winnerLabel: null,
      ctrLiftPercent: null,
      confidenceAtCompletion: null,
    })
    createdTestIds.push(test2Id)

    // Active test — should NOT appear in testHistory
    const { data: activeTest, error: activeErr } = await supabase
      .from('ab_tests')
      .insert({
        site_id: siteId,
        youtube_video_id: videoId, // internal uuid — see seedCompletedAbTest note
        name: 'Active test — should be excluded',
        test_type: 'thumbnail',
        status: 'active',
        started_at: new Date().toISOString(),
        config: {
          max_duration_days: 14,
          confidence_threshold: 0.95,
          burn_in_days: 2,
          auto_apply_winner: true,
          rotation_pattern: 'abba',
        },
        original_thumbnail_url: 'https://i.ytimg.com/vi/test/hqdefault.jpg',
      })
      .select('id')
      .single()
    if (activeErr || !activeTest) throw new Error(`Active test insert: ${activeErr?.message}`)
    createdTestIds.push(activeTest.id)

    const result = await fetchAbBriefingData(videoId)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { testHistory } = result.data
    expect(Array.isArray(testHistory)).toBe(true)

    // Only completed tests should be present
    expect(testHistory).toHaveLength(2)

    // Each history entry has the required shape
    for (const entry of testHistory) {
      expect(entry).toHaveProperty('test_type')
      expect(entry).toHaveProperty('winner_label')
      expect(entry).toHaveProperty('ctr_lift_percent')
    }

    // The thumbnail test with a winner should be in history
    const thumbnailEntry = testHistory.find(t => t.test_type === 'thumbnail')
    expect(thumbnailEntry).toBeDefined()
    expect(thumbnailEntry?.winner_label).toBe('variant_b')
    expect(thumbnailEntry?.ctr_lift_percent).toBe(12.5)

    // The title test with no winner should also be present
    const titleEntry = testHistory.find(t => t.test_type === 'title')
    expect(titleEntry).toBeDefined()
    expect(titleEntry?.winner_label).toBeNull()
    expect(titleEntry?.ctr_lift_percent).toBeNull()
  })
})
