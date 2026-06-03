import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { preflightTokenCheck } from '@/lib/youtube/ab-preflight'
import { getNextVariantIndex } from '@/lib/youtube/ab-rotation'
import { applyVariantToYouTube } from '@/lib/youtube/ab-apply'
import { createNotification } from '@/lib/notifications/create'
import { startAbTestInternal } from '@/lib/youtube/ab-start'
import type { AbTestVariantRow } from '@/lib/youtube/ab-types'

type SupabaseClient = ReturnType<typeof getSupabaseServiceClient>

export interface RotateResult {
  processed: number
  errors: number
}

// ─── Phase 1: Process queued tests whose start time has arrived ──────────────

export async function phaseProcessQueue(supabase: SupabaseClient): Promise<number> {
  const { data: queuedTests } = await supabase
    .from('ab_tests')
    .select('id, site_id, youtube_video_id, name')
    .eq('status', 'queued')
    .not('queue_start_after', 'is', null)
    .lte('queue_start_after', new Date().toISOString())

  if (!queuedTests?.length) return 0

  let started = 0
  for (const queued of queuedTests) {
    try {
      await supabase
        .from('ab_tests')
        .update({ status: 'draft', queue_start_after: null })
        .eq('id', queued.id)
        .eq('status', 'queued')

      await startAbTestInternal(queued.id, queued.site_id)
      started++
    } catch (err) {
      // Revert status on failure
      await supabase
        .from('ab_tests')
        .update({ status: 'queued' })
        .eq('id', queued.id)
      Sentry.captureException(err, { extra: { testId: queued.id, context: 'queue-start' } })
    }
  }

  return started
}

// ─── Phase 2: Rotate active tests ───────────────────────────────────────────

export async function phaseRotateActiveTests(supabase: SupabaseClient): Promise<RotateResult> {
  // Query all active tests with their variants and video info
  const { data: tests } = await supabase
    .from('ab_tests')
    .select(`
      *,
      variants:ab_test_variants!test_id(*)
    `)
    .eq('status', 'active')

  if (!tests || tests.length === 0) {
    return { processed: 0, errors: 0 }
  }

  let processed = 0
  let errors = 0

  for (const test of tests) {
    // Hoist video + channel so they're accessible in the catch block (auto-pause-revert)
    let video: { youtube_video_id: string; channel_id: string } | null = null
    let channel: { channel_id: string } | null = null

    try {
      const variants = (test.variants as AbTestVariantRow[]).sort(
        (a, b) => a.sort_order - b.sort_order
      )

      // Get youtube_video_id and channel info for correct token selection
      const { data: videoRow } = await supabase
        .from('youtube_videos')
        .select('youtube_video_id, channel_id')
        .eq('id', test.youtube_video_id)
        .single()

      video = videoRow
      if (!video) continue

      // Idempotency: skip if we already rotated today
      const today = new Date().toISOString().slice(0, 10)
      const { data: todayCycle } = await supabase
        .from('ab_test_cycles')
        .select('id')
        .eq('test_id', test.id)
        .gte('started_at', `${today}T00:00:00Z`)
        .limit(1)
        .maybeSingle()

      if (todayCycle) continue

      // Write-ahead marker recovery: if marker is set, previous run crashed after YouTube call
      if (test.last_applied_variant_id) {
        Sentry.captureMessage(
          `ab-rotate: write-ahead marker found for test ${test.id} (variant ${test.last_applied_variant_id}). Previous run likely crashed after YouTube API call. Clearing marker and skipping.`,
          'warning'
        )
        await supabase
          .from('ab_tests')
          .update({ last_applied_variant_id: null })
          .eq('id', test.id)
        continue
      }

      // Resolve the YouTube channel_id to use the correct OAuth token
      const { data: channelRow } = await supabase
        .from('youtube_channels')
        .select('channel_id')
        .eq('id', video.channel_id)
        .single()
      channel = channelRow

      const preflight = await preflightTokenCheck(test.site_id, 'youtube', channel?.channel_id)
      if (!preflight.ok) {
        const { data: owner } = await supabase.from('site_users').select('user_id').eq('site_id', test.site_id).eq('role', 'super_admin').limit(1).single()
        if (owner) {
          await createNotification({
            site_id: test.site_id,
            user_id: owner.user_id,
            type: 'youtube.token_invalid',
            domain: 'youtube',
            priority: 1,
            title: 'Token YouTube inválido',
            message: `Não foi possível acessar a API do YouTube: ${preflight.reason}`,
            action_href: '/cms/youtube',
            dedup_key: `token-invalid-${test.site_id}-${new Date().toISOString().slice(0, 10)}`,
          })
        }
        continue
      }
      const accessToken = preflight.accessToken

      // Count only completed (closed) cycles for correct ABBA position
      const { count } = await supabase
        .from('ab_test_cycles')
        .select('*', { count: 'exact', head: true })
        .eq('test_id', test.id)
        .not('ended_at', 'is', null)

      const nextCycle = (count ?? 0) + 1
      const pattern = test.config?.rotation_pattern ?? 'abba'
      const nextVariantIndex = getNextVariantIndex(pattern, variants.length, nextCycle)
      const nextVariant = variants[nextVariantIndex]

      if (!nextVariant) continue

      // Write-ahead marker: record intent BEFORE calling YouTube API
      await supabase
        .from('ab_tests')
        .update({ last_applied_variant_id: nextVariant.id })
        .eq('id', test.id)

      // Apply variant based on test type
      const testType = test.test_type ?? 'thumbnail'

      const applyResult = await applyVariantToYouTube({
        youtubeVideoId: video.youtube_video_id,
        accessToken,
        testType: testType as 'thumbnail' | 'title' | 'description' | 'combo',
        variant: {
          id: nextVariant.id,
          blob_url: nextVariant.blob_url,
          title_text: nextVariant.title_text,
          description_text: nextVariant.description_text,
        },
        originalTitle: test.original_title,
        originalDescription: test.original_description,
      })

      if (!applyResult.ok) throw new Error(applyResult.error ?? 'apply failed')
      const appliedMeta = applyResult.meta

      // Snapshot latest poll stats before closing cycle
      const { data: cyclePolls } = await supabase
        .from('ab_test_polls')
        .select('views, likes')
        .eq('test_id', test.id)
        .order('polled_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      // Close old cycle + open new cycle AFTER YouTube confirms
      await supabase
        .from('ab_test_cycles')
        .update({
          ended_at: new Date().toISOString(),
          views: cyclePolls?.views ?? null,
          likes: cyclePolls?.likes ?? null,
        })
        .eq('test_id', test.id)
        .is('ended_at', null)

      await supabase.from('ab_test_cycles').insert({
        test_id: test.id,
        variant_id: nextVariant.id,
        cycle_number: nextCycle,
        started_at: new Date().toISOString(),
        applied_metadata: Object.keys(appliedMeta).length ? appliedMeta : null,
      })

      // Success — reset failure counter + clear write-ahead marker
      await supabase
        .from('ab_tests')
        .update({
          last_applied_variant_id: null,
          ...(test.config?.consecutive_failures ? { config: { ...test.config, consecutive_failures: 0 } } : {}),
        })
        .eq('id', test.id)

      processed++
    } catch (err) {
      errors++
      Sentry.captureException(err, {
        tags: { cron: 'ab-rotate' },
        extra: { testId: test.id },
      })

      // Track consecutive failures for auth/quota errors — only pause after 3
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('401') || msg.includes('403') || msg.includes('429')) {
        const reason = msg.includes('401') ? 'token expired'
          : msg.includes('403') ? 'insufficient permissions'
          : 'API quota exceeded'

        const prevFailures = (test.config?.consecutive_failures as number) ?? 0
        const failures = prevFailures + 1
        const MAX_FAILURES = 3

        if (failures >= MAX_FAILURES) {
          try {
            const { data: testFull } = await supabase
              .from('ab_tests')
              .select('original_thumbnail_url, site_id')
              .eq('id', test.id)
              .single()
            if (testFull?.original_thumbnail_url?.includes('blob.vercel-storage.com') && video) {
              const { ensureFreshToken } = await import('@/lib/social/token-refresh')
              const { fetchVariantImageBuffer, setThumbnail } = await import('@/lib/youtube/ab-youtube')
              const { accessToken } = await ensureFreshToken(testFull.site_id, 'youtube', channel?.channel_id)
              const { buffer, contentType } = await fetchVariantImageBuffer(testFull.original_thumbnail_url)
              await setThumbnail(video.youtube_video_id, buffer, contentType, accessToken)
            }
          } catch (revertErr) {
            Sentry.captureException(revertErr, {
              tags: { cron: 'ab-rotate', action: 'auto-pause-revert' },
              extra: { testId: test.id },
            })
          }

          await supabase
            .from('ab_tests')
            .update({
              status: 'paused',
              status_note: `auto-paused after ${failures} consecutive failures: ${reason}`,
              paused_at: new Date().toISOString(),
              config: { ...test.config, consecutive_failures: failures },
            })
            .eq('id', test.id)
        } else {
          // Keep active but track the failure
          await supabase
            .from('ab_tests')
            .update({
              config: { ...test.config, consecutive_failures: failures },
              status_note: `retry ${failures}/${MAX_FAILURES}: ${reason}`,
            })
            .eq('id', test.id)
        }
      }
    }
  }

  return { processed, errors }
}
