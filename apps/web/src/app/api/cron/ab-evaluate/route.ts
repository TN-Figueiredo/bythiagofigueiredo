import { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'
import {
  phaseAutoStartPlayoffs,
  phaseEvaluateActiveTests,
  phaseRetryFailedApplies,
  phaseDetectPlayoffEligibility,
} from '@/lib/youtube/ab-evaluate-phases'

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
  })
}
