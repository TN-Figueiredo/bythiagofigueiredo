import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { getVariantForCycle } from '@/lib/youtube/ab-rotation'
import {
  setThumbnail,
  fetchVariantImageBuffer,
} from '@/lib/youtube/ab-youtube'
import type { AbTestVariantRow } from '@/lib/youtube/ab-types'

export const maxDuration = 120

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()

  // Query all active tests with their variants and video info
  const { data: tests } = await supabase
    .from('ab_tests')
    .select(`
      *,
      variants:ab_test_variants(*)
    `)
    .eq('status', 'active')

  if (!tests || tests.length === 0) {
    return Response.json({ status: 'ok', processed: 0 })
  }

  let processed = 0
  let errors = 0

  for (const test of tests) {
    try {
      const variants = (test.variants as AbTestVariantRow[]).sort(
        (a, b) => a.sort_order - b.sort_order
      )

      // Get youtube_video_id from the youtube_videos table
      const { data: video } = await supabase
        .from('youtube_videos')
        .select('youtube_video_id')
        .eq('id', test.youtube_video_id)
        .single()

      if (!video) continue

      const { accessToken } = await ensureFreshToken(test.site_id, 'youtube')

      // Close current cycle
      await supabase
        .from('ab_test_cycles')
        .update({ ended_at: new Date().toISOString() })
        .eq('test_id', test.id)
        .is('ended_at', null)

      // Get completed cycle count for next ABBA position
      const { count } = await supabase
        .from('ab_test_cycles')
        .select('*', { count: 'exact', head: true })
        .eq('test_id', test.id)

      const nextCycle = count ?? 0
      const nextVariantIndex = getVariantForCycle(variants.length, nextCycle)
      const nextVariant = variants[nextVariantIndex]

      if (!nextVariant) continue

      // Apply thumbnail
      if (nextVariant.blob_url) {
        const { buffer, contentType } = await fetchVariantImageBuffer(nextVariant.blob_url)
        await setThumbnail(video.youtube_video_id, buffer, contentType, accessToken)
      }

      // Open new cycle
      await supabase.from('ab_test_cycles').insert({
        test_id: test.id,
        variant_id: nextVariant.id,
        cycle_number: nextCycle,
        started_at: new Date().toISOString(),
      })

      processed++
    } catch (err) {
      errors++
      Sentry.captureException(err, {
        tags: { cron: 'ab-rotate' },
        extra: { testId: test.id },
      })

      // Auto-pause on auth failure
      if (err instanceof Error && err.message.includes('401')) {
        await supabase
          .from('ab_tests')
          .update({
            status: 'paused',
            status_note: 'paused: token expired',
            paused_at: new Date().toISOString(),
          })
          .eq('id', test.id)
      }
    }
  }

  return Response.json({ status: 'ok', processed, errors })
}
