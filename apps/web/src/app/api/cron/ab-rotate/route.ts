import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { getNextVariantIndex } from '@/lib/youtube/ab-rotation'
import {
  setThumbnail,
  fetchVariantImageBuffer,
} from '@/lib/youtube/ab-youtube'
import { updateVideoMetadata } from '@/lib/youtube/ab-metadata'
import { resolveTemplates } from '@/lib/youtube/ab-templates'
import type { AbTestVariantRow, AppliedMetadata } from '@/lib/youtube/ab-types'

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
      variants:ab_test_variants!test_id(*)
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

      // Count only completed cycles for correct ABBA position
      const { count } = await supabase
        .from('ab_test_cycles')
        .select('*', { count: 'exact', head: true })
        .eq('test_id', test.id)
        .not('ended_at', 'is', null)

      const nextCycle = count ?? 0
      const pattern = test.config?.rotation_pattern ?? 'abba'
      const nextVariantIndex = getNextVariantIndex(pattern, variants.length, nextCycle)
      const nextVariant = variants[nextVariantIndex]

      if (!nextVariant) continue

      // Apply variant based on test type
      const appliedMeta: AppliedMetadata = {}
      const testType = test.test_type ?? 'thumbnail'

      if ((testType === 'thumbnail' || testType === 'combo') && nextVariant.blob_url) {
        const { buffer, contentType } = await fetchVariantImageBuffer(nextVariant.blob_url)
        await setThumbnail(video.youtube_video_id, buffer, contentType, accessToken)
        appliedMeta.thumbnail_set = true
      }

      if (testType === 'title' || testType === 'description' || testType === 'combo') {
        let titleToSet: string | null = null
        let descToSet: string | null = null

        if (testType === 'title' || testType === 'combo') {
          titleToSet = nextVariant.title_text ?? test.original_title ?? null
        }
        if (testType === 'description' || testType === 'combo') {
          const rawDesc = nextVariant.description_text ?? test.original_description ?? null
          if (rawDesc) {
            const { data: linkMappings } = await supabase
              .from('ab_test_tracked_links')
              .select('template_name, short_code')
              .eq('variant_id', nextVariant.id)

            const linkMap: Record<string, string> = {}
            const shortDomain = process.env.LINKS_SHORT_DOMAIN ?? 'go.bythiagofigueiredo.com'
            for (const lm of linkMappings ?? []) {
              linkMap[lm.template_name] = `https://${shortDomain}/${lm.short_code}`
            }
            descToSet = resolveTemplates(rawDesc, linkMap)
            appliedMeta.links_resolved = linkMap
          }
        }

        if (titleToSet || descToSet) {
          await updateVideoMetadata(video.youtube_video_id, titleToSet, descToSet, accessToken)
          appliedMeta.title_set = titleToSet
          appliedMeta.description_set = descToSet
        }
      }

      // Open new cycle
      await supabase.from('ab_test_cycles').insert({
        test_id: test.id,
        variant_id: nextVariant.id,
        cycle_number: nextCycle,
        started_at: new Date().toISOString(),
        applied_metadata: Object.keys(appliedMeta).length ? appliedMeta : null,
      })

      // Success — reset failure counter
      if (test.config?.consecutive_failures) {
        await supabase
          .from('ab_tests')
          .update({ config: { ...test.config, consecutive_failures: 0 } })
          .eq('id', test.id)
      }

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

  return Response.json({ status: 'ok', processed, errors })
}
