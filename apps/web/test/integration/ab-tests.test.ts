import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY } from '../helpers/db-seed'
import { createClient } from '@supabase/supabase-js'

describe.skipIf(skipIfNoLocalDb())('ab-tests integration', () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  let siteId: string
  let videoId: string
  let testId: string

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
        'Need at least one non-Short youtube_videos row for AB test integration tests',
      )
    }
    videoId = video.id
  })

  afterAll(async () => {
    if (testId) {
      await supabase.from('ab_test_cycles').delete().eq('test_id', testId)
      await supabase.from('ab_test_variants').delete().eq('test_id', testId)
      await supabase.from('ab_tests').delete().eq('id', testId)
    }
  })

  it('creates a draft test', async () => {
    const { data, error } = await supabase
      .from('ab_tests')
      .insert({
        site_id: siteId,
        youtube_video_id: videoId,
        name: 'Integration Test',
        config: {
          max_duration_days: 14,
          confidence_threshold: 0.95,
          burn_in_days: 2,
          auto_apply_winner: true,
          rotation_pattern: 'abba',
        },
        original_thumbnail_url: 'https://i.ytimg.com/vi/test/hqdefault.jpg',
      })
      .select('id, status')
      .single()

    expect(error).toBeNull()
    expect(data!.status).toBe('draft')
    testId = data!.id
  })

  it('creates original variant', async () => {
    const { error } = await supabase
      .from('ab_test_variants')
      .insert({
        test_id: testId,
        label: 'original',
        is_original: true,
        blob_url: 'https://example.com/original.jpg',
        sort_order: 0,
      })
    expect(error).toBeNull()
  })

  it('creates challenger variant', async () => {
    const { error } = await supabase
      .from('ab_test_variants')
      .insert({
        test_id: testId,
        label: 'variant_b',
        is_original: false,
        blob_url: 'https://example.com/variant_b.jpg',
        blob_key: 'ab-test/test/variant_b.jpg',
        sort_order: 1,
      })
    expect(error).toBeNull()
  })

  it('transitions draft → active', async () => {
    const { error } = await supabase
      .from('ab_tests')
      .update({ status: 'active', started_at: new Date().toISOString() })
      .eq('id', testId)
    expect(error).toBeNull()

    const { data } = await supabase
      .from('ab_tests')
      .select('status')
      .eq('id', testId)
      .single()
    expect(data!.status).toBe('active')
  })

  it('creates a cycle', async () => {
    const { data: variant } = await supabase
      .from('ab_test_variants')
      .select('id')
      .eq('test_id', testId)
      .eq('is_original', false)
      .limit(1)
      .single()

    const { error } = await supabase
      .from('ab_test_cycles')
      .insert({
        test_id: testId,
        variant_id: variant!.id,
        cycle_number: 0,
      })
    expect(error).toBeNull()
  })

  it('transitions active → paused', async () => {
    const { error } = await supabase
      .from('ab_tests')
      .update({ status: 'paused', paused_at: new Date().toISOString() })
      .eq('id', testId)
    expect(error).toBeNull()
  })

  it('transitions paused → completed', async () => {
    const { error } = await supabase
      .from('ab_tests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_reason: 'manual_archive',
      })
      .eq('id', testId)
    expect(error).toBeNull()
  })

  it('enforces one-active-per-video constraint', async () => {
    // Reset test to active so the partial unique index (draft/active/paused) is active
    await supabase
      .from('ab_tests')
      .update({ status: 'active', completed_at: null, completed_reason: null })
      .eq('id', testId)

    // Attempt to insert a second active test for the same video — must fail
    const { error } = await supabase
      .from('ab_tests')
      .insert({
        site_id: siteId,
        youtube_video_id: videoId,
        name: 'Duplicate Test',
        config: {},
        original_thumbnail_url: 'https://example.com/thumb.jpg',
        status: 'active',
        started_at: new Date().toISOString(),
      })

    expect(error).not.toBeNull()

    // Restore completed state so afterAll cleanup can proceed cleanly
    await supabase
      .from('ab_tests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_reason: 'manual_archive',
      })
      .eq('id', testId)
  })
})
