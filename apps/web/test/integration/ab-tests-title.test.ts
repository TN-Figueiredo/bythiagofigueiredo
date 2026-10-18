import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite, seedYoutubeChannelAndVideo } from '../helpers/db-seed'
import { createClient } from '@supabase/supabase-js'

describe.skipIf(skipIfNoLocalDb())('ab-tests title integration', () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  let siteId: string
  let videoId: string
  let channelId: string

  // Track created IDs for cleanup
  const createdTestIds: string[] = []
  const createdLinkIds: string[] = []

  beforeAll(async () => {
    // Fresh local DBs have no YouTube data — and youtube_channels enforces
    // UNIQUE (site_id, locale), so seed an isolated site + non-Short video
    // (sharing the master site collides with parallel test files).
    const seededSite = await seedSite(supabase)
    siteId = seededSite.siteId

    const seeded = await seedYoutubeChannelAndVideo(supabase, siteId)
    videoId = seeded.videoId
    channelId = seeded.channelId
  })

  afterAll(async () => {
    // Cleanup in reverse FK order
    for (const testId of createdTestIds) {
      await supabase.from('ab_test_cycles').delete().eq('test_id', testId)
      await supabase.from('ab_test_variants').delete().eq('test_id', testId)
      await supabase.from('ab_tests').delete().eq('id', testId)
    }
    for (const linkId of createdLinkIds) {
      await supabase.from('tracked_links').delete().eq('id', linkId)
    }
    if (videoId) await supabase.from('youtube_videos').delete().eq('id', videoId)
    if (channelId) await supabase.from('youtube_channels').delete().eq('id', channelId)
    if (siteId) await supabase.from('sites').delete().eq('id', siteId)
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Group 1: Title test type
  // ─────────────────────────────────────────────────────────────────────────────

  describe('title test type', () => {
    let titleTestId: string

    it('creates a test_type=title test with original_title', async () => {
      const { data, error } = await supabase
        .from('ab_tests')
        .insert({
          site_id: siteId,
          youtube_video_id: videoId,
          name: 'Title AB Test',
          test_type: 'title',
          original_title: 'My Original Video Title',
          config: {
            max_duration_days: 7,
            confidence_threshold: 0.90,
            burn_in_days: 1,
            auto_apply_winner: false,
            rotation_pattern: 'abba',
          },
          original_thumbnail_url: 'https://i.ytimg.com/vi/test/hqdefault.jpg',
        })
        .select('id, test_type, original_title, status')
        .single()

      expect(error).toBeNull()
      expect(data!.test_type).toBe('title')
      expect(data!.original_title).toBe('My Original Video Title')
      expect(data!.status).toBe('draft')
      titleTestId = data!.id
      createdTestIds.push(titleTestId)
    })

    it('creates a variant with title_text', async () => {
      const { data, error } = await supabase
        .from('ab_test_variants')
        .insert({
          test_id: titleTestId,
          label: 'title_variant_a',
          is_original: false,
          title_text: 'A Better Title That Gets More Clicks',
          sort_order: 1,
        })
        .select('id, title_text')
        .single()

      expect(error).toBeNull()
      expect(data!.title_text).toBe('A Better Title That Gets More Clicks')
    })

    it('stores variant metadata JSONB correctly', async () => {
      const metadataPayload = {
        source: 'ai_suggestion',
        confidence: 0.85,
        tags: ['clickbait', 'curiosity'],
      }

      const { data, error } = await supabase
        .from('ab_test_variants')
        .insert({
          test_id: titleTestId,
          label: 'title_variant_b',
          is_original: false,
          title_text: 'Another Title Option',
          metadata: metadataPayload,
          sort_order: 2,
        })
        .select('id, metadata')
        .single()

      expect(error).toBeNull()
      expect(data!.metadata).toEqual(metadataPayload)
    })

    it('rejects invalid test_type values', async () => {
      const { error } = await supabase
        .from('ab_tests')
        .insert({
          site_id: siteId,
          youtube_video_id: videoId,
          name: 'Invalid Type Test',
          test_type: 'invalid_type',
          config: {},
          original_thumbnail_url: 'https://example.com/thumb.jpg',
        })

      expect(error).not.toBeNull()
      expect(error!.message).toMatch(/check|violates|constraint/i)
    })

    it('o banco recusa test_type = description (Migration A)', async () => {
      const { error } = await supabase
        .from('ab_tests')
        .insert({
          site_id: siteId,
          youtube_video_id: videoId,
          name: 'Description Type Test',
          test_type: 'description',
          config: {},
          original_thumbnail_url: 'https://example.com/thumb.jpg',
        })

      expect(error?.code).toBe('23514') // check_violation
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Group 3: Combo test type
  // ─────────────────────────────────────────────────────────────────────────────

  describe('combo test type', () => {
    let comboTestId: string

    beforeAll(async () => {
      // Free the video slot by completing any existing test
      await supabase
        .from('ab_tests')
        .update({ status: 'completed', completed_at: new Date().toISOString(), completed_reason: 'manual_archive' })
        .eq('youtube_video_id', videoId)
        .in('status', ['draft', 'active', 'paused'])
    })

    it('creates a test_type=combo with original_title', async () => {
      const { data, error } = await supabase
        .from('ab_tests')
        .insert({
          site_id: siteId,
          youtube_video_id: videoId,
          name: 'Combo AB Test',
          test_type: 'combo',
          original_title: 'Original Combo Title',
          config: {
            max_duration_days: 21,
            confidence_threshold: 0.90,
            burn_in_days: 3,
            auto_apply_winner: true,
            rotation_pattern: 'abba',
          },
          original_thumbnail_url: 'https://i.ytimg.com/vi/test/combo.jpg',
        })
        .select('id, test_type, original_title')
        .single()

      expect(error).toBeNull()
      expect(data!.test_type).toBe('combo')
      expect(data!.original_title).toBe('Original Combo Title')
      comboTestId = data!.id
      createdTestIds.push(comboTestId)
    })

    it('creates a variant with blob_url + title_text', async () => {
      const { data, error } = await supabase
        .from('ab_test_variants')
        .insert({
          test_id: comboTestId,
          label: 'combo_variant_a',
          is_original: false,
          blob_url: 'https://example.com/combo-thumbnail.jpg',
          title_text: 'New Combo Title - More Engaging',
          sort_order: 1,
        })
        .select('id, blob_url, title_text')
        .single()

      expect(error).toBeNull()
      expect(data!.blob_url).toBe('https://example.com/combo-thumbnail.jpg')
      expect(data!.title_text).toBe('New Combo Title - More Engaging')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Group 4: Cycles with applied_metadata
  // ─────────────────────────────────────────────────────────────────────────────

  describe('cycles with applied_metadata', () => {
    let cycleTestId: string

    beforeAll(async () => {
      // Free the video slot by completing any existing test
      await supabase
        .from('ab_tests')
        .update({ status: 'completed', completed_at: new Date().toISOString(), completed_reason: 'manual_archive' })
        .eq('youtube_video_id', videoId)
        .in('status', ['draft', 'active', 'paused'])
    })

    it('creates a cycle with applied_metadata JSONB', async () => {
      // Create a test to hold the cycle
      const { data: test } = await supabase
        .from('ab_tests')
        .insert({
          site_id: siteId,
          youtube_video_id: videoId,
          name: 'Cycle Metadata Test',
          test_type: 'combo',
          original_title: 'Cycle Test Title',
          status: 'active',
          started_at: new Date().toISOString(),
          config: {
            max_duration_days: 14,
            confidence_threshold: 0.95,
            burn_in_days: 2,
            auto_apply_winner: true,
            rotation_pattern: 'abba',
          },
          original_thumbnail_url: 'https://i.ytimg.com/vi/test/cycle.jpg',
        })
        .select('id')
        .single()

      cycleTestId = test!.id
      createdTestIds.push(cycleTestId)

      // Create a variant for the cycle
      const { data: variant } = await supabase
        .from('ab_test_variants')
        .insert({
          test_id: cycleTestId,
          label: 'cycle_variant',
          is_original: false,
          title_text: 'New Title',
          sort_order: 1,
        })
        .select('id')
        .single()

      const appliedMetadata = {
        title_set: 'New Title',
      }

      const { data: cycle, error } = await supabase
        .from('ab_test_cycles')
        .insert({
          test_id: cycleTestId,
          variant_id: variant!.id,
          cycle_number: 0,
          applied_metadata: appliedMetadata,
        })
        .select('id, applied_metadata')
        .single()

      expect(error).toBeNull()
      expect(cycle!.applied_metadata).toEqual(appliedMetadata)
    })

    it('queries cycle and confirms applied_metadata is returned correctly', async () => {
      const { data: cycles, error } = await supabase
        .from('ab_test_cycles')
        .select('cycle_number, applied_metadata')
        .eq('test_id', cycleTestId)
        .order('cycle_number', { ascending: true })

      expect(error).toBeNull()
      expect(cycles!.length).toBeGreaterThanOrEqual(1)

      const cycle = cycles![0]
      expect(cycle.applied_metadata).toBeDefined()
      expect(cycle.applied_metadata.title_set).toBe('New Title')
    })
  })
})
