import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'
import {
  phaseAutoStartPlayoffs,
  phaseEvaluateActiveTests,
  phaseRetryFailedApplies,
  phaseDetectPlayoffEligibility,
} from '@/lib/youtube/ab-evaluate-phases'
import { runLongevityChecks } from '@/lib/youtube/thumbnail-library'

export const maxDuration = 120

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()

  const playoffs = await phaseAutoStartPlayoffs(supabase)
  const evaluation = await phaseEvaluateActiveTests(supabase)
  const retries = await phaseRetryFailedApplies(supabase)
  const playoffEligibility = await phaseDetectPlayoffEligibility(supabase)

  // Phase 5: Longevity checks
  let longevityChecked = 0
  try {
    const { data: libSites } = await supabase
      .from('thumbnail_library')
      .select('site_id')
      .limit(100)

    const uniqueSiteIds = new Set((libSites ?? []).map(s => s.site_id as string))
    for (const site of uniqueSiteIds) {
      longevityChecked += await runLongevityChecks(site)
    }
  } catch (err) {
    Sentry.captureException(err, { extra: { context: 'longevity-checks' } })
  }

  const totalErrors = evaluation.errors + playoffs.errors + retries.errors + playoffEligibility.errors

  if (totalErrors === 0) {
    await recordCronSuccess('ab-evaluate', 'critical')
  } else {
    await recordCronFailure('ab-evaluate', `${totalErrors} error(s)`, 'critical')
  }

  return Response.json({
    status: 'ok',
    evaluated: evaluation.evaluated,
    resolved: evaluation.resolved + retries.resolved,
    errors: totalErrors,
    applies_retried: retries.processed,
    playoffs_started: playoffs.processed,
    playoffs_created: playoffEligibility.processed,
    longevity_checked: longevityChecked,
  })
}
