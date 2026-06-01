import * as Sentry from '@sentry/nextjs'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { calculateBayesianConfidence } from '@/lib/youtube/ab-statistics'
import { applyVariantToYouTube } from '@/lib/youtube/ab-apply'
import { preflightTokenCheck } from '@/lib/youtube/ab-preflight'
import { buildNotification } from '@/lib/youtube/notification-service'
import { getIsoWeek } from '@/lib/youtube/analytics-sync'
import { checkPlayoffEligibility, selectPlayoffVariants } from '@/lib/youtube/ab-playoff'
import { startAbTestInternal } from '@/lib/youtube/ab-start'
import { autoImportWinner } from '@/lib/youtube/thumbnail-library'
import type { AbTestVariantRow, AbTestCycleRow, VariantStats, AbTestConfig, BackfillStatus } from '@/lib/youtube/ab-types'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

type SupabaseClient = ReturnType<typeof getSupabaseServiceClient>

export interface PhaseResult {
  processed: number
  errors: number
}

export interface EvaluateResult {
  evaluated: number
  resolved: number
  errors: number
}

// ─── Phase 1: Auto-start Round 2 drafts past cooldown ────────────────────────

export async function phaseAutoStartPlayoffs(supabase: SupabaseClient): Promise<PhaseResult> {
  let processed = 0
  let errors = 0

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
      if (result.ok) processed++
    } catch (err) {
      errors++
      Sentry.captureException(err, {
        tags: { cron: 'ab-evaluate', phase: 'playoff-start' },
        extra: { testId: playoff.id },
      })
    }
  }

  return { processed, errors }
}

// ─── Phase 2: Evaluate active tests (Bayesian + gates + grace period) ────────

export async function phaseEvaluateActiveTests(supabase: SupabaseClient): Promise<EvaluateResult> {
  let evaluated = 0
  let resolved = 0
  let errors = 0

  const { data: tests } = await supabase
    .from('ab_tests')
    .select(`
      *,
      variants:ab_test_variants!test_id(*),
      cycles:ab_test_cycles(*)
    `)
    .eq('status', 'active')

  if (!tests || tests.length === 0) {
    return { evaluated: 0, resolved: 0, errors: 0 }
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
        const winnerId = bayesian.winnerId
        const winnerLabel = variants.find(v => v.id === winnerId)?.label ?? 'Variante'

        if (!test.grace_expires_at) {
          // FIRST TIME winner detected — start 24h grace period
          await supabase
            .from('ab_tests')
            .update({
              grace_expires_at: new Date(Date.now() + 24 * 3600000).toISOString(),
              winner_variant_id: winnerId,
              confidence_at_completion: bayesian.confidence,
            })
            .eq('id', test.id)

          // Notify user: winner pending
          await supabase.rpc('create_yt_notification', {
            p_site_id: test.site_id,
            p_type: 'ab_test_winner_pending',
            p_priority: 3,
            p_title: `Vencedor detectado: ${winnerLabel}`,
            p_message: `O teste "${test.name}" tem um vencedor. Será aplicado automaticamente em 24h.`,
            p_action_href: `/cms/youtube/ab-lab/${test.id}`,
            p_video_id: test.youtube_video_id,
          })

          evaluated++
          continue // Don't apply yet — wait for grace period
        }

        // Grace period set — check if expired
        if (new Date(test.grace_expires_at) > new Date()) {
          // Grace period not yet expired
          evaluated++
          continue
        }

        // GRACE PERIOD EXPIRED — now apply winner
        const winner = variants.find(v => v.id === winnerId)

        const { data: video } = await supabase
          .from('youtube_videos')
          .select('youtube_video_id')
          .eq('id', test.youtube_video_id)
          .single()

        if (video) {
          const { data: videoForChannel } = await supabase
            .from('youtube_videos')
            .select('channel_id')
            .eq('id', test.youtube_video_id)
            .single()

          const { data: channelRow } = videoForChannel?.channel_id
            ? await supabase.from('youtube_channels').select('channel_id').eq('id', videoForChannel.channel_id).single()
            : { data: null }

          const { accessToken } = await ensureFreshToken(test.site_id, 'youtube', channelRow?.channel_id)

          if (winner) {
            await applyVariantToYouTube({
              youtubeVideoId: video.youtube_video_id,
              accessToken,
              testType: test.test_type as 'thumbnail' | 'title' | 'description' | 'combo',
              variant: {
                id: winner.id,
                blob_url: winner.blob_url,
                title_text: winner.title_text,
                description_text: winner.description_text,
              },
              originalTitle: test.original_title,
              originalDescription: test.original_description,
            })
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
            winner_applied_at: new Date().toISOString(),
            applied_by: 'auto',
            revert_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
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

        // Auto-import winning thumbnail to library
        try {
          await autoImportWinner(test.id, test.site_id)
        } catch {
          // Non-fatal — library import failure shouldn't block test completion
        }

        resolved++
      } else if (test.grace_expires_at && newConsecutive < stabilityThreshold) {
        // Confidence dropped during grace period — cancel auto-apply
        await supabase
          .from('ab_tests')
          .update({
            grace_expires_at: null,
            winner_variant_id: null,
            confidence_at_completion: null,
          })
          .eq('id', test.id)
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

  return { evaluated, resolved, errors }
}

// ─── Phase 3: Retry failed applies ──────────────────────────────────────────

export async function phaseRetryFailedApplies(supabase: SupabaseClient): Promise<PhaseResult & { resolved: number }> {
  let processed = 0
  let resolved = 0
  let errors = 0

  // Exponential backoff delays: attempt 0→1 waits 1h, 1→2 waits 4h, 2→3 waits 12h
  const retryDelaysMs = [3_600_000, 14_400_000, 43_200_000] // 1h, 4h, 12h

  const { data: pendingApplies } = await supabase
    .from('ab_tests')
    .select('id, site_id, winner_variant_id, youtube_video_id, test_type, original_title, original_description, apply_attempts, name, grace_expires_at')
    .not('grace_expires_at', 'is', null)
    .is('winner_applied_at', null)
    .not('winner_variant_id', 'is', null)
    .lte('grace_expires_at', new Date().toISOString())
    .lt('apply_attempts', 3)
    .eq('status', 'active')

  for (const pending of pendingApplies ?? []) {
    try {
      // Exponential backoff: skip if not enough time since grace expired
      const timeSinceGraceExpired = Date.now() - new Date(pending.grace_expires_at!).getTime()
      const attemptIndex = Math.min(pending.apply_attempts ?? 0, retryDelaysMs.length - 1)
      const requiredDelay = retryDelaysMs[attemptIndex]!
      if (timeSinceGraceExpired < requiredDelay) continue

      const { data: videoForChannel2 } = await supabase
        .from('youtube_videos')
        .select('channel_id')
        .eq('id', pending.youtube_video_id)
        .single()

      const { data: channelRow2 } = videoForChannel2?.channel_id
        ? await supabase.from('youtube_channels').select('channel_id').eq('id', videoForChannel2.channel_id).single()
        : { data: null }

      const preflight = await preflightTokenCheck(pending.site_id, 'youtube', channelRow2?.channel_id)
      if (!preflight.ok) throw new Error(`preflight_failed: ${preflight.reason}`)

      const { data: video } = await supabase
        .from('youtube_videos')
        .select('youtube_video_id')
        .eq('id', pending.youtube_video_id)
        .single()

      if (!video) throw new Error('video_not_found')

      const { data: winner } = await supabase
        .from('ab_test_variants')
        .select('id, label, blob_url, title_text, description_text')
        .eq('id', pending.winner_variant_id!)
        .single()

      if (!winner) throw new Error('winner_variant_not_found')

      // Validate blob asset before applying
      if (winner.blob_url && (pending.test_type === 'thumbnail' || pending.test_type === 'combo')) {
        const headRes = await fetch(winner.blob_url, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
        if (!headRes.ok) throw new Error(`asset_missing: blob returned ${headRes.status}`)
      }

      const applyResult = await applyVariantToYouTube({
        youtubeVideoId: video.youtube_video_id,
        accessToken: preflight.accessToken,
        testType: pending.test_type as 'thumbnail' | 'title' | 'description' | 'combo',
        variant: {
          id: winner.id,
          blob_url: winner.blob_url,
          title_text: winner.title_text,
          description_text: winner.description_text,
        },
        originalTitle: pending.original_title,
        originalDescription: pending.original_description,
      })

      if (!applyResult.ok) throw new Error(applyResult.error ?? 'apply failed')

      // Success — close cycle and mark completed
      await supabase
        .from('ab_test_cycles')
        .update({ ended_at: new Date().toISOString() })
        .eq('test_id', pending.id)
        .is('ended_at', null)

      await supabase
        .from('ab_tests')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_reason: 'auto_resolve',
          winner_applied_at: new Date().toISOString(),
          applied_by: 'auto',
          revert_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        })
        .eq('id', pending.id)

      // Transition optimization cycle
      const { data: cycle } = await supabase
        .from('optimization_cycles')
        .select('id')
        .eq('youtube_video_id', pending.youtube_video_id)
        .eq('state', 'testing')
        .single()

      if (cycle) {
        await supabase.from('optimization_cycles').update({
          state: 'post_test_monitoring',
          test_completed_at: new Date().toISOString(),
          test_winner_applied_at: new Date().toISOString(),
        }).eq('id', cycle.id)
      }

      // Auto-import winning thumbnail to library
      try {
        await autoImportWinner(pending.id, pending.site_id)
      } catch {
        // Non-fatal — library import failure shouldn't block test completion
      }

      processed++
      resolved++
    } catch (err) {
      errors++
      const attempts = (pending.apply_attempts ?? 0) + 1
      await supabase
        .from('ab_tests')
        .update({
          apply_attempts: attempts,
          last_apply_error: err instanceof Error ? err.message : 'unknown',
        })
        .eq('id', pending.id)

      // After 3 failures — send notification
      if (attempts >= 3) {
        await supabase.rpc('create_yt_notification', {
          p_site_id: pending.site_id,
          p_type: 'ab_test_apply_failed',
          p_priority: 4,
          p_title: `Falha ao aplicar vencedor: ${pending.name}`,
          p_message: `O teste "${pending.name}" falhou 3x ao aplicar o vencedor. Ação manual necessária.`,
          p_action_href: `/cms/youtube/ab-lab/${pending.id}`,
          p_video_id: pending.youtube_video_id,
        })
      }

      Sentry.captureException(err, {
        tags: { cron: 'ab-evaluate', phase: 'apply-retry' },
        extra: { testId: pending.id, attempts },
      })
    }
  }

  return { processed, errors, resolved }
}

// ─── Phase 4: Detect playoff eligibility ─────────────────────────────────────

export async function phaseDetectPlayoffEligibility(supabase: SupabaseClient): Promise<PhaseResult> {
  let processed = 0
  let errors = 0

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

      processed++
    } catch (err) {
      errors++
      Sentry.captureException(err, {
        tags: { cron: 'ab-evaluate', phase: 'playoff-detect' },
        extra: { testId: candidate.id },
      })
    }
  }

  return { processed, errors }
}
