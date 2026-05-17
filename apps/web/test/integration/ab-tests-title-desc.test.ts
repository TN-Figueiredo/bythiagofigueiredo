import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY } from '../helpers/db-seed'
import { createClient } from '@supabase/supabase-js'

describe.skipIf(skipIfNoLocalDb())('ab-tests title/desc integration', () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  let siteId: string
  let videoId: string

  // Track created IDs for cleanup
  const createdTestIds: string[] = []
  const createdLinkIds: string[] = []

  beforeAll(async () => {
    // Get existing site
    const { data: site } = await supabase
      .from('sites')
      .select('id')
      .limit(1)
      .single()
    siteId = site!.id

    // Get a non-Short video
    const { data: video } = await supabase
      .from('youtube_videos')
      .select('id')
      .eq('site_id', siteId)
      .gt('duration_seconds', 60)
      .limit(1)
      .single()

    if (!video) {
      throw new Error(
        'Need at least one non-Short youtube_videos row for AB test title/desc integration tests',
      )
    }
    videoId = video.id
  })

  afterAll(async () => {
    // Cleanup in reverse FK order
    for (const testId of createdTestIds) {
      await supabase.from('ab_test_tracked_links').delete().eq('ab_test_id', testId)
      await supabase.from('ab_test_cycles').delete().eq('test_id', testId)
      await supabase.from('ab_test_variants').delete().eq('test_id', testId)
      await supabase.from('ab_tests').delete().eq('id', testId)
    }
    for (const linkId of createdLinkIds) {
      await supabase.from('tracked_links').delete().eq('id', linkId)
    }
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
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Group 2: Description test type with tracked links
  // ─────────────────────────────────────────────────────────────────────────────

  describe('description test type with tracked links', () => {
    let descTestId: string
    let descVariantId: string
    let trackedLinkId: string

    beforeAll(async () => {
      // Free the video slot by completing any existing test
      await supabase
        .from('ab_tests')
        .update({ status: 'completed', completed_at: new Date().toISOString(), completed_reason: 'manual_archive' })
        .eq('youtube_video_id', videoId)
        .in('status', ['draft', 'active', 'paused'])
    })

    it('creates a test_type=description test with original_description', async () => {
      const { data, error } = await supabase
        .from('ab_tests')
        .insert({
          site_id: siteId,
          youtube_video_id: videoId,
          name: 'Description AB Test',
          test_type: 'description',
          original_description: 'This is the original video description with links and info.',
          config: {
            max_duration_days: 14,
            confidence_threshold: 0.95,
            burn_in_days: 2,
            auto_apply_winner: true,
            rotation_pattern: 'round_robin',
          },
          original_thumbnail_url: 'https://i.ytimg.com/vi/test/hqdefault.jpg',
        })
        .select('id, test_type, original_description, status')
        .single()

      expect(error).toBeNull()
      expect(data!.test_type).toBe('description')
      expect(data!.original_description).toBe(
        'This is the original video description with links and info.',
      )
      descTestId = data!.id
      createdTestIds.push(descTestId)
    })

    it('creates a variant with description_text containing link tokens', async () => {
      const descriptionWithTokens =
        'Check out my course: {{link:course_cta}}\n\nFollow me: {{link:social_links}}'

      const { data, error } = await supabase
        .from('ab_test_variants')
        .insert({
          test_id: descTestId,
          label: 'desc_variant_a',
          is_original: false,
          description_text: descriptionWithTokens,
          sort_order: 1,
        })
        .select('id, description_text')
        .single()

      expect(error).toBeNull()
      expect(data!.description_text).toContain('{{link:course_cta}}')
      expect(data!.description_text).toContain('{{link:social_links}}')
      descVariantId = data!.id
    })

    it('inserts rows into ab_test_tracked_links joining variant and link', async () => {
      // Create a tracked_links row first (FK reference)
      const { data: link } = await supabase
        .from('tracked_links')
        .insert({
          site_id: siteId,
          code: 'test-ab-' + Date.now(),
          destination_url: 'https://example.com/dest',
          source_type: 'ab_test',
          source_id: descTestId,
          label: 'Test Link',
        })
        .select('id, code')
        .single()

      expect(link).not.toBeNull()
      trackedLinkId = link!.id
      createdLinkIds.push(trackedLinkId)

      const { data, error } = await supabase
        .from('ab_test_tracked_links')
        .insert({
          ab_test_id: descTestId,
          variant_id: descVariantId,
          link_id: trackedLinkId,
          template_name: 'course_cta',
          short_code: link!.code,
        })
        .select('id, ab_test_id, variant_id, template_name')
        .single()

      expect(error).toBeNull()
      expect(data!.ab_test_id).toBe(descTestId)
      expect(data!.variant_id).toBe(descVariantId)
      expect(data!.template_name).toBe('course_cta')
    })

    it('enforces unique constraint on (ab_test_id, variant_id, template_name)', async () => {
      // Create another tracked link for the duplicate attempt
      const { data: link2 } = await supabase
        .from('tracked_links')
        .insert({
          site_id: siteId,
          code: 'test-ab-dup-' + Date.now(),
          destination_url: 'https://example.com/dest2',
          source_type: 'ab_test',
          source_id: descTestId,
          label: 'Test Link 2',
        })
        .select('id, code')
        .single()

      createdLinkIds.push(link2!.id)

      // Insert with same (ab_test_id, variant_id, template_name) — should fail
      const { error } = await supabase
        .from('ab_test_tracked_links')
        .insert({
          ab_test_id: descTestId,
          variant_id: descVariantId,
          link_id: link2!.id,
          template_name: 'course_cta', // same template_name as before
          short_code: link2!.code,
        })

      expect(error).not.toBeNull()
      expect(error!.message).toMatch(/unique|duplicate|already exists/i)
    })

    it('deleting the test cascades to ab_test_tracked_links', async () => {
      // First confirm tracked_links rows exist
      const { data: before } = await supabase
        .from('ab_test_tracked_links')
        .select('id')
        .eq('ab_test_id', descTestId)

      expect(before!.length).toBeGreaterThan(0)

      // Delete the test (cascades through variants → tracked_links)
      await supabase.from('ab_test_cycles').delete().eq('test_id', descTestId)
      await supabase.from('ab_test_variants').delete().eq('test_id', descTestId)
      await supabase.from('ab_tests').delete().eq('id', descTestId)

      // Confirm tracked_links rows are gone
      const { data: after } = await supabase
        .from('ab_test_tracked_links')
        .select('id')
        .eq('ab_test_id', descTestId)

      expect(after!.length).toBe(0)

      // Remove from cleanup list since already deleted
      const idx = createdTestIds.indexOf(descTestId)
      if (idx !== -1) createdTestIds.splice(idx, 1)
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

    it('creates a test_type=combo with both original_title and original_description', async () => {
      const { data, error } = await supabase
        .from('ab_tests')
        .insert({
          site_id: siteId,
          youtube_video_id: videoId,
          name: 'Combo AB Test',
          test_type: 'combo',
          original_title: 'Original Combo Title',
          original_description: 'Original combo description with all the details.',
          config: {
            max_duration_days: 21,
            confidence_threshold: 0.90,
            burn_in_days: 3,
            auto_apply_winner: true,
            rotation_pattern: 'abba',
          },
          original_thumbnail_url: 'https://i.ytimg.com/vi/test/combo.jpg',
        })
        .select('id, test_type, original_title, original_description')
        .single()

      expect(error).toBeNull()
      expect(data!.test_type).toBe('combo')
      expect(data!.original_title).toBe('Original Combo Title')
      expect(data!.original_description).toBe(
        'Original combo description with all the details.',
      )
      comboTestId = data!.id
      createdTestIds.push(comboTestId)
    })

    it('creates a variant with blob_url + title_text + description_text', async () => {
      const { data, error } = await supabase
        .from('ab_test_variants')
        .insert({
          test_id: comboTestId,
          label: 'combo_variant_a',
          is_original: false,
          blob_url: 'https://example.com/combo-thumbnail.jpg',
          title_text: 'New Combo Title - More Engaging',
          description_text:
            'New description for combo variant with {{link:main_cta}} included.',
          sort_order: 1,
        })
        .select('id, blob_url, title_text, description_text')
        .single()

      expect(error).toBeNull()
      expect(data!.blob_url).toBe('https://example.com/combo-thumbnail.jpg')
      expect(data!.title_text).toBe('New Combo Title - More Engaging')
      expect(data!.description_text).toContain('{{link:main_cta}}')
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
          original_description: 'Cycle test description',
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
          description_text: 'New Desc with {{link:cta}}',
          sort_order: 1,
        })
        .select('id')
        .single()

      const appliedMetadata = {
        title_set: 'New Title',
        description_set: 'New Desc with resolved link',
        links_resolved: { cta: 'https://go.example.com/abc' },
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
      expect(cycle.applied_metadata.description_set).toBe(
        'New Desc with resolved link',
      )
      expect(cycle.applied_metadata.links_resolved).toEqual({
        cta: 'https://go.example.com/abc',
      })
    })
  })
})
