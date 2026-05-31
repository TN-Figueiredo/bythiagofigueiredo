import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { calculateBayesianConfidence } from '@/lib/youtube/ab-statistics'
import { setThumbnail, fetchVariantImageBuffer } from '@/lib/youtube/ab-youtube'
import { updateVideoMetadata } from '@/lib/youtube/ab-metadata'
import { resolveTemplates } from '@/lib/youtube/ab-templates'
import { buildNotification } from '@/lib/youtube/notification-service'
import { getIsoWeek } from '@/lib/youtube/analytics-sync'
import { checkPlayoffEligibility, selectPlayoffVariants } from '@/lib/youtube/ab-playoff'
import { startAbTestInternal } from '@/lib/youtube/ab-start'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'
import type { AbTestVariantRow, AbTestCycleRow, VariantStats, AbTestConfig, BackfillStatus } from '@/lib/youtube/ab-types'

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
      variants:ab_test_variants!test_id(*),
      cycles:ab_test_cycles(*)
    `)
    .eq('status', 'active')

  if (!tests || tests.length === 0) {
    return Response.json({ status: 'ok', evaluated: 0 })
  }

  let evaluated = 0
  let resolved = 0
  let errors = 0

  // Phase 1: Auto-start Round 2 drafts past cooldown
  let playoffsStarted = 0
  {
    const { data: pendingPlayoffs } = await supabase
      .from('ab_tests')
      .select('id, site_id, round_number, parent_test_id, playoff_start_after')
      .eq('status', 'draft')
      .eq('round_number', 2)
      .not('parent_test_id', 'is', null)
      .not('playoff_start_after', 'is', null)
      .lte('playoff_start_after', new Date().toISOString())

    for (const playoff of pendingPlayoffs ?? []) {
      try {
        const result = await startAbTestInternal(playoff.id as string, playoff.site_id as string)
        if (result.ok) playoffsStarted++
      } catch (err) {
        Sentry.captureException(err, {
          tags: { cron: 'ab-evaluate', phase: 'playoff-start' },
          extra: { testId: playoff.id },
        })
      }
    }
  }

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
          title_text: v.title_text ?? null,
          description_text: v.description_text ?? null,
          metadata: v.metadata ?? {},
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
      const stabilityThreshold = config.stability_threshold ?? 3

      const gates = [
        { name: 'confidence', passed: bayesian.confidence >= threshold, detail: `${(bayesian.confidence * 100).toFixed(1)}% >= ${threshold * 100}%` },
        { name: 'min_impressions', passed: activeVariants.every(v => v.total_impressions >= 1000), detail: `min: ${Math.min(...activeVariants.map(v => v.total_impressions))}` },
        { name: 'min_duration', passed: daysSinceStart >= 7, detail: `${daysSinceStart.toFixed(0)} days` },
        { name: 'min_cycles', passed: confirmedCycles.length >= 14, detail: `${confirmedCycles.length} cycles` },
        { name: 'burn_in', passed: burnInEnd === 0 || eligibleCycles.length > 0, detail: `burn-in: ${burnInEnd} cycles` },
        { name: 'stability', passed: (test.consecutive_confident_evals ?? 0) >= (stabilityThreshold - 1), detail: `${test.consecutive_confident_evals ?? 0} consecutive` },
      ]

      // Update consecutive confidence counter
      const newConsecutive = bayesian.confidence >= threshold
        ? (test.consecutive_confident_evals ?? 0) + 1
        : 0

      await supabase
        .from('ab_tests')
        .update({ consecutive_confident_evals: newConsecutive })
        .eq('id', test.id)

      const allPass = gates.every(g => g.passed) && newConsecutive >= stabilityThreshold

      if (allPass && (config.auto_apply_winner ?? true)) {
        // Auto-resolve: apply winner
        const winner = variants.find(v => v.id === bayesian.winnerId)

        const { data: video } = await supabase
          .from('youtube_videos')
          .select('youtube_video_id')
          .eq('id', test.youtube_video_id)
          .single()

        if (video) {
          const { accessToken } = await ensureFreshToken(test.site_id, 'youtube')

          // Apply thumbnail for thumbnail/combo tests
          if (winner?.blob_url && (test.test_type === 'thumbnail' || test.test_type === 'combo')) {
            const { buffer, contentType } = await fetchVariantImageBuffer(winner.blob_url)
            await setThumbnail(video.youtube_video_id, buffer, contentType, accessToken)
          }

          // Apply title/description for title/description/combo tests
          if (winner && (test.test_type === 'title' || test.test_type === 'description' || test.test_type === 'combo')) {
            const titleToApply = (test.test_type === 'title' || test.test_type === 'combo')
              ? (winner.title_text ?? test.original_title ?? null) : null
            let descToApply: string | null = null
            if (test.test_type === 'description' || test.test_type === 'combo') {
              const rawDesc = winner.description_text ?? test.original_description ?? null
              if (rawDesc) {
                const { data: linkMappings } = await supabase
                  .from('ab_test_tracked_links')
                  .select('template_name, short_code')
                  .eq('variant_id', winner.id)
                const linkMap: Record<string, string> = {}
                const shortDomain = process.env.LINKS_SHORT_DOMAIN ?? 'go.bythiagofigueiredo.com'
                for (const lm of linkMappings ?? []) {
                  linkMap[lm.template_name] = `https://${shortDomain}/${lm.short_code}`
                }
                descToApply = resolveTemplates(rawDesc, linkMap)
              }
            }
            if (titleToApply || descToApply) {
              await updateVideoMetadata(video.youtube_video_id, titleToApply, descToApply, accessToken)
            }
          }
        }

        const original = variantStats.find(v => v.is_original)
        const winnerStats = variantStats.find(v => v.variant_id === bayesian.winnerId)
        const ctrLift = original && winnerStats && original.avg_ctr > 0
          ? ((winnerStats.avg_ctr - original.avg_ctr) / original.avg_ctr) * 100
          : 0

        const totalTestImpressions = activeVariants.reduce((s, v) => s + v.total_impressions, 0)
        const dailyImpressions = daysSinceStart > 0 ? totalTestImpressions / daysSinceStart : 0
        const monthlyImpressions = dailyImpressions * 30
        const extraClicksPerMonth = original && winnerStats && winnerStats.avg_ctr > original.avg_ctr
          ? Math.round((winnerStats.avg_ctr - original.avg_ctr) * monthlyImpressions)
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
              total_impressions: totalTestImpressions,
              estimated_monthly_extra_clicks: extraClicksPerMonth,
            },
          })
          .eq('id', test.id)

        // Emit notification for completed test
        const weekIso = getIsoWeek(new Date())
        const notifPayload = buildNotification({
          type: 'ab_test_completed',
          videoId: test.youtube_video_id,
          videoTitle: test.name ?? 'Vídeo',
          testName: test.name ?? 'A/B Test',
          winnerLabel: winner?.label ?? 'Variante vencedora',
          ctrLift: Math.round(ctrLift * 10) / 10,
          weekIso,
        })
        await supabase.rpc('create_yt_notification', {
          p_site_id: test.site_id,
          p_type: notifPayload.type,
          p_priority: notifPayload.priority,
          p_title: notifPayload.title,
          p_message: notifPayload.message,
          p_dedup_key: notifPayload.dedup_key,
          p_video_id: notifPayload.video_id ?? null,
          p_ab_test_id: test.id,
          p_action_href: notifPayload.action_href ?? null,
        })

        // Transition optimization cycle to post_test_monitoring
        const { data: cycle } = await supabase
          .from('optimization_cycles')
          .select('id')
          .eq('youtube_video_id', test.youtube_video_id)
          .eq('state', 'testing')
          .single()

        if (cycle) {
          await supabase.from('optimization_cycles').update({
            state: 'post_test_monitoring',
            test_completed_at: new Date().toISOString(),
            test_winner_applied_at: new Date().toISOString(),
          }).eq('id', cycle.id)
        }

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
      errors++
      Sentry.captureException(err, {
        tags: { cron: 'ab-evaluate' },
        extra: { testId: test.id },
      })
    }
  }

  // Phase 3: Detect inconclusive Round 1 tests eligible for playoff
  let playoffsCreated = 0
  {
    const { data: candidates } = await supabase
      .from('ab_tests')
      .select(`
        *,
        variants:ab_test_variants!test_id(*),
        cycles:ab_test_cycles(*)
      `)
      .eq('status', 'completed')
      .eq('completed_reason', 'inconclusive')
      .in('test_type', ['thumbnail', 'combo'])
      .eq('round_number', 1)
      .is('parent_test_id', null)
      .is('playoff_test_id', null)

    for (const candidate of candidates ?? []) {
      try {
        const variants = (candidate.variants as AbTestVariantRow[]).sort(
          (a, b) => a.sort_order - b.sort_order,
        )
        const allCycles = (candidate.cycles as AbTestCycleRow[])
        const terminalStatuses: BackfillStatus[] = ['confirmed', 'no_data', 'error']
        const allBackfilled = allCycles.every(c =>
          terminalStatuses.includes(c.backfill_status),
        )

        const confirmedCycles = allCycles.filter(c => c.backfill_status === 'confirmed')
        const variantStats: VariantStats[] = variants.map(v => {
          const vCycles = confirmedCycles.filter(c => c.variant_id === v.id)
          const totalImpressions = vCycles.reduce((s, c) => s + (c.impressions ?? 0), 0)
          const totalClicks = vCycles.reduce((s, c) => s + (c.clicks ?? 0), 0)
          return {
            variant_id: v.id,
            label: v.label,
            blob_url: v.blob_url,
            title_text: v.title_text ?? null,
            description_text: v.description_text ?? null,
            metadata: v.metadata ?? {},
            is_original: v.is_original,
            total_impressions: totalImpressions,
            total_clicks: totalClicks,
            avg_ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
            cycles_completed: vCycles.length,
          }
        })

        const eligibility = checkPlayoffEligibility(
          {
            completed_reason: candidate.completed_reason,
            test_type: candidate.test_type,
            round_number: candidate.round_number ?? 1,
            parent_test_id: candidate.parent_test_id ?? null,
            playoff_test_id: candidate.playoff_test_id ?? null,
            started_at: candidate.started_at,
          },
          variantStats,
          allBackfilled,
        )

        if (!eligibility.eligible) continue

        const selection = selectPlayoffVariants(variantStats)
        if (!selection) continue

        const { error: rpcError } = await supabase.rpc('create_playoff_test', {
          p_parent_test_id: candidate.id,
          p_variant_ids: selection.variantIds,
          p_cooldown_hours: 4,
        })

        if (rpcError) {
          Sentry.captureException(new Error(rpcError.message), {
            tags: { cron: 'ab-evaluate', phase: 'playoff-create' },
            extra: { testId: candidate.id },
          })
          continue
        }

        const weekIso = getIsoWeek(new Date())
        const notifPayload = buildNotification({
          type: 'playoff_created',
          videoId: candidate.youtube_video_id as string,
          videoTitle: candidate.name ?? 'Vídeo',
          testName: candidate.name ?? 'A/B Test',
          variant1Label: selection.labels[0],
          variant2Label: selection.labels[1],
          weekIso,
        })

        await supabase.rpc('create_yt_notification', {
          p_site_id: candidate.site_id,
          p_type: notifPayload.type,
          p_priority: notifPayload.priority,
          p_title: notifPayload.title,
          p_message: notifPayload.message,
          p_dedup_key: notifPayload.dedup_key,
          p_video_id: notifPayload.video_id ?? null,
          p_ab_test_id: candidate.id,
          p_action_href: notifPayload.action_href ?? null,
        })

        playoffsCreated++
      } catch (err) {
        errors++
        Sentry.captureException(err, {
          tags: { cron: 'ab-evaluate', phase: 'playoff-detect' },
          extra: { testId: candidate.id },
        })
      }
    }
  }

  if (errors === 0) {
    await recordCronSuccess('ab-evaluate', 'critical')
  } else {
    await recordCronFailure('ab-evaluate', `${errors} test(s) failed`, 'critical')
  }

  return Response.json({ status: 'ok', evaluated, resolved, errors, playoffs_started: playoffsStarted, playoffs_created: playoffsCreated })
}
