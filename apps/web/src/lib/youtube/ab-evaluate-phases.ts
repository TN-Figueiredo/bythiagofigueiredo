import * as Sentry from '@sentry/nextjs'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { calculateBayesianConfidence } from '@/lib/youtube/ab-statistics'
import { applyVariantToYouTube, isAutoApplyEnabled } from '@/lib/youtube/ab-apply'
import { computeGates } from '@/lib/youtube/ab-gates'
import { preflightTokenCheck } from '@/lib/youtube/ab-preflight'
import { buildNotification } from '@/lib/youtube/notification-service'
import { fanOutToSiteAdmins } from '@/lib/notifications/fan-out-to-admins'
import { getIsoWeek } from '@/lib/youtube/analytics-sync'
import { checkPlayoffEligibility, selectPlayoffVariants } from '@/lib/youtube/ab-playoff'
import { startAbTestInternal } from '@/lib/youtube/ab-start'
import { autoImportWinner } from '@/lib/youtube/thumbnail-library'
import { applyCycleTransition } from '@/lib/youtube/optimization-loop'
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

      const startedAt = new Date(test.started_at ?? test.created_at)
      const daysSinceStart = Math.floor((Date.now() - startedAt.getTime()) / 86400000)
      const maxDurationDays = config.max_duration_days ?? 14

      const activeVariants = variantStats.filter(v => v.total_impressions > 0)
      if (activeVariants.length < 2) {
        // F17: a test can sit here forever if it never gets a 2nd variant with impressions
        // (dead channel, stuck rotation, YouTube API returning nothing). Without this check
        // it skipped the max_duration gate entirely and stayed "active" indefinitely.
        if (daysSinceStart >= maxDurationDays) {
          // No variant ever ran long enough to matter — nothing to revert.
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
              confidence_at_completion: null,
            })
            .eq('id', test.id)

          resolved++
        }
        evaluated++
        continue
      }

      const bayesian = calculateBayesianConfidence(activeVariants)

      const threshold = config.confidence_threshold ?? 0.95
      const stabilityThreshold = config.stability_threshold ?? 3

      // F18: single source of truth for the 6 auto-resolve gates — the cron used to
      // reimplement this array by hand with a fixed cycles floor, while the UI
      // (ab-lab/queries.ts) called computeGates with `variantCount * 7`. A 3-variant test
      // could show "ready" in the UI (needs 21 confirmed) while the cron used a much lower,
      // hardcoded bar regardless of variant count.
      const gates = computeGates({
        confidence: bayesian.confidence,
        threshold,
        minImpressions: activeVariants.map(v => v.total_impressions),
        daysSinceStart,
        confirmedCycles: confirmedCycles.length,
        burnInDays: config.burn_in_days ?? 2,
        variantCount: variants.length,
        eligibleCycles: eligibleCycles.length,
        consecutiveConfident: test.consecutive_confident_evals ?? 0,
        stabilityThreshold,
      })

      // Update consecutive confidence counter
      const newConsecutive = bayesian.confidence >= threshold
        ? (test.consecutive_confident_evals ?? 0) + 1
        : 0

      await supabase
        .from('ab_tests')
        .update({ consecutive_confident_evals: newConsecutive })
        .eq('id', test.id)

      // gates already includes a 'stability' gate comparing consecutiveConfident (pre-update)
      // against stabilityThreshold — no need to redundantly re-check newConsecutive here.
      const allPass = gates.every(g => g.passed)

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
          await fanOutToSiteAdmins({
            siteId: test.site_id,
            domain: 'youtube',
            type: 'youtube.ab_test_winner_pending',
            priority: 3,
            title: `Vencedor detectado: ${winnerLabel}`,
            message: `O teste "${test.name}" tem um vencedor. Será aplicado automaticamente em 24h.`,
            dedupKey: `ab_test_winner_pending:${test.id}`,
            payload: { videoId: test.youtube_video_id, testId: test.id },
            actionHref: `/cms/youtube/ab-lab/${test.id}`,
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

        // GRACE PERIOD EXPIRED — apply winner, unless auto-apply is disabled (F19)
        if (!isAutoApplyEnabled()) {
          const winnerLabel2 = variants.find(v => v.id === winnerId)?.label ?? 'Variante'

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
              confidence_at_completion: bayesian.confidence,
              // winner_variant_id already recorded when grace period started.
              // applied_by / winner_applied_at stay null — nothing was applied to YouTube.
              // A human can still apply it manually via the existing ab-lab action, which
              // only checks winner_variant_id + winner_applied_at, not status.
            })
            .eq('id', test.id)

          await fanOutToSiteAdmins({
            siteId: test.site_id,
            domain: 'youtube',
            type: 'youtube.ab_test_winner_suggested',
            priority: 3,
            title: `Vencedor sugerido: ${winnerLabel2}`,
            message: `O teste "${test.name}" tem um vencedor sugerido. Aplicacao automatica esta desligada (confianca calculada sobre cliques, que hoje sao sempre zero) — revise e aplique manualmente.`,
            dedupKey: `ab_test_winner_suggested:${test.id}`,
            payload: { videoId: test.youtube_video_id, testId: test.id },
            actionHref: `/cms/youtube/ab-lab/${test.id}`,
          })

          resolved++
          evaluated++
          continue
        }

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
        await fanOutToSiteAdmins({
          siteId: test.site_id,
          domain: 'youtube',
          type: `youtube.${notifPayload.type}`,
          priority: notifPayload.priority,
          title: notifPayload.title,
          message: notifPayload.message,
          dedupKey: notifPayload.dedup_key,
          payload: {
            ...(notifPayload.video_id ? { videoId: notifPayload.video_id } : {}),
            testId: test.id,
          },
          actionHref: notifPayload.action_href,
        })

        // Transition optimization cycle to post_test_monitoring
        const { data: cycle } = await supabase
          .from('optimization_cycles')
          .select('*')
          .eq('youtube_video_id', test.youtube_video_id)
          .eq('state', 'testing')
          .single()

        if (cycle) {
          await applyCycleTransition(supabase, cycle.id, 'post_test_monitoring', {})
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
      if (!allPass && daysSinceStart >= maxDurationDays) {
        // Best-effort revert to original thumbnail
        try {
          if (test.original_thumbnail_url?.includes('blob.vercel-storage.com')) {
            const { data: revertVideo } = await supabase
              .from('youtube_videos')
              .select('youtube_video_id')
              .eq('id', test.youtube_video_id)
              .single()

            if (revertVideo) {
              const { fetchVariantImageBuffer, setThumbnail } = await import('@/lib/youtube/ab-youtube')
              const { data: revertVideoChannel } = await supabase
                .from('youtube_videos')
                .select('channel_id')
                .eq('id', test.youtube_video_id)
                .single()
              const { data: revertChannel } = revertVideoChannel?.channel_id
                ? await supabase.from('youtube_channels').select('channel_id').eq('id', revertVideoChannel.channel_id).single()
                : { data: null }
              const { accessToken } = await ensureFreshToken(test.site_id, 'youtube', revertChannel?.channel_id)
              const { buffer, contentType } = await fetchVariantImageBuffer(test.original_thumbnail_url)
              await setThumbnail(revertVideo.youtube_video_id, buffer, contentType, accessToken)
            }
          }
        } catch (e) {
          Sentry.captureException(e, { extra: { context: 'max-duration-revert', testId: test.id } })
        }

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
        .select('*')
        .eq('youtube_video_id', pending.youtube_video_id)
        .eq('state', 'testing')
        .single()

      if (cycle) {
        await applyCycleTransition(supabase, cycle.id, 'post_test_monitoring', {})
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
        await fanOutToSiteAdmins({
          siteId: pending.site_id,
          domain: 'youtube',
          type: 'youtube.ab_test_apply_failed',
          priority: 4,
          title: `Falha ao aplicar vencedor: ${pending.name}`,
          message: `O teste "${pending.name}" falhou 3x ao aplicar o vencedor. Ação manual necessária.`,
          dedupKey: `ab_test_apply_failed:${pending.id}`,
          payload: { videoId: pending.youtube_video_id, testId: pending.id },
          actionHref: `/cms/youtube/ab-lab/${pending.id}`,
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

      await fanOutToSiteAdmins({
        siteId: candidate.site_id,
        domain: 'youtube',
        type: `youtube.${notifPayload.type}`,
        priority: notifPayload.priority,
        title: notifPayload.title,
        message: notifPayload.message,
        dedupKey: notifPayload.dedup_key,
        payload: {
          ...(notifPayload.video_id ? { videoId: notifPayload.video_id } : {}),
          testId: candidate.id,
        },
        actionHref: notifPayload.action_href,
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
