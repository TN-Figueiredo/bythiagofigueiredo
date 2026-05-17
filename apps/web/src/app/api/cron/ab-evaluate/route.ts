import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { calculateBayesianConfidence } from '@/lib/youtube/ab-statistics'
import { setThumbnail, fetchVariantImageBuffer } from '@/lib/youtube/ab-youtube'
import type { AbTestVariantRow, AbTestCycleRow, VariantStats, AbTestConfig } from '@/lib/youtube/ab-types'

export const maxDuration = 120

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()

  const { data: tests } = await supabase
    .from('ab_tests')
    .select(`
      *,
      variants:ab_test_variants(*),
      cycles:ab_test_cycles(*)
    `)
    .eq('status', 'active')

  if (!tests || tests.length === 0) {
    return Response.json({ status: 'ok', evaluated: 0 })
  }

  let evaluated = 0
  let resolved = 0

  for (const test of tests) {
    try {
      const config = test.config as AbTestConfig
      const variants = (test.variants as AbTestVariantRow[]).sort((a, b) => a.sort_order - b.sort_order)
      const allCycles = (test.cycles as AbTestCycleRow[]).sort((a, b) => a.cycle_number - b.cycle_number)

      const confirmedCycles = allCycles.filter(c => c.backfill_status === 'confirmed')
      const burnInEnd = (config.burn_in_days ?? 2) * variants.length
      const eligibleCycles = confirmedCycles.filter(c => c.cycle_number >= burnInEnd)

      // Aggregate stats per variant from eligible cycles
      const variantStats: VariantStats[] = variants.map(v => {
        const vCycles = eligibleCycles.filter(c => c.variant_id === v.id)
        const totalImpressions = vCycles.reduce((s, c) => s + (c.impressions ?? 0), 0)
        const totalClicks = vCycles.reduce((s, c) => s + (c.clicks ?? 0), 0)
        return {
          variant_id: v.id,
          label: v.label,
          blob_url: v.blob_url,
          is_original: v.is_original,
          total_impressions: totalImpressions,
          total_clicks: totalClicks,
          avg_ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
          cycles_completed: vCycles.length,
        }
      })

      const activeVariants = variantStats.filter(v => v.total_impressions > 0)
      if (activeVariants.length < 2) { evaluated++; continue }

      const bayesian = calculateBayesianConfidence(activeVariants)

      // 6 auto-resolve gates
      const startedAt = new Date(test.started_at ?? test.created_at)
      const daysSinceStart = (Date.now() - startedAt.getTime()) / (1000 * 60 * 60 * 24)
      const threshold = config.confidence_threshold ?? 0.95

      const gates = [
        { name: 'confidence', passed: bayesian.confidence >= threshold, detail: `${(bayesian.confidence * 100).toFixed(1)}% >= ${threshold * 100}%` },
        { name: 'min_impressions', passed: activeVariants.every(v => v.total_impressions >= 1000), detail: `min: ${Math.min(...activeVariants.map(v => v.total_impressions))}` },
        { name: 'min_duration', passed: daysSinceStart >= 7, detail: `${daysSinceStart.toFixed(0)} days` },
        { name: 'min_cycles', passed: confirmedCycles.length >= 14, detail: `${confirmedCycles.length} cycles` },
        { name: 'burn_in', passed: burnInEnd === 0 || eligibleCycles.length > 0, detail: `burn-in: ${burnInEnd} cycles` },
        { name: 'stability', passed: (test.consecutive_confident_evals ?? 0) >= 2, detail: `${test.consecutive_confident_evals ?? 0} consecutive` },
      ]

      // Update consecutive confidence counter
      const newConsecutive = bayesian.confidence >= threshold
        ? (test.consecutive_confident_evals ?? 0) + 1
        : 0

      await supabase
        .from('ab_tests')
        .update({ consecutive_confident_evals: newConsecutive })
        .eq('id', test.id)

      const allPass = gates.every(g => g.passed) && newConsecutive >= 3

      if (allPass && (config.auto_apply_winner ?? true)) {
        // Auto-resolve: apply winner thumbnail
        const winner = variants.find(v => v.id === bayesian.winnerId)
        if (winner?.blob_url) {
          const { data: video } = await supabase
            .from('youtube_videos')
            .select('youtube_video_id')
            .eq('id', test.youtube_video_id)
            .single()

          if (video) {
            const { accessToken } = await ensureFreshToken(test.site_id, 'youtube')
            const { buffer, contentType } = await fetchVariantImageBuffer(winner.blob_url)
            await setThumbnail(video.youtube_video_id, buffer, contentType, accessToken)
          }
        }

        const original = variantStats.find(v => v.is_original)
        const winnerStats = variantStats.find(v => v.variant_id === bayesian.winnerId)
        const ctrLift = original && winnerStats && original.avg_ctr > 0
          ? ((winnerStats.avg_ctr - original.avg_ctr) / original.avg_ctr) * 100
          : 0

        // Close open cycle and complete test
        await supabase
          .from('ab_test_cycles')
          .update({ ended_at: new Date().toISOString() })
          .eq('test_id', test.id)
          .is('ended_at', null)

        await supabase
          .from('ab_tests')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            completed_reason: 'auto_resolve',
            winner_variant_id: bayesian.winnerId,
            confidence_at_completion: bayesian.confidence,
            result_metadata: {
              ctr_lift_percent: Math.round(ctrLift * 10) / 10,
              winner_label: winner?.label ?? '',
              total_impressions: activeVariants.reduce((s, v) => s + v.total_impressions, 0),
              estimated_monthly_extra_clicks: 0,
            },
          })
          .eq('id', test.id)

        resolved++
      }

      // Check max duration — mark inconclusive if exceeded
      if (!allPass && daysSinceStart >= (config.max_duration_days ?? 14)) {
        await supabase
          .from('ab_test_cycles')
          .update({ ended_at: new Date().toISOString() })
          .eq('test_id', test.id)
          .is('ended_at', null)

        await supabase
          .from('ab_tests')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            completed_reason: 'inconclusive',
            confidence_at_completion: bayesian.confidence,
          })
          .eq('id', test.id)
      }

      evaluated++
    } catch (err) {
      Sentry.captureException(err, {
        tags: { cron: 'ab-evaluate' },
        extra: { testId: test.id },
      })
    }
  }

  return Response.json({ status: 'ok', evaluated, resolved })
}
