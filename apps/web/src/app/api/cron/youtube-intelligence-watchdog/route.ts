/**
 * GET/POST /api/cron/youtube-intelligence-watchdog
 *
 * Fecha F15: `youtube_intelligence_tasks` can get stuck in `running` (worker crash,
 * timed-out request) and nothing ever moved them out. `idx_yt_intel_task_active` only
 * covers `pending`/`running`, so a stuck row blocks the channel from ever being
 * re-analyzed. The `stale` status already exists in the CHECK constraint
 * (`20260517000003_analytics_intelligence.sql:235`) and was never written — this
 * watchdog writes it for tasks that have been `running` past a threshold.
 *
 * Registered in vercel.json by WP-B (dono unico do arquivo) — GET alias for Vercel Cron,
 * POST for pg_cron/manual triggers, per the project's cron split-brain convention.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'
import * as Sentry from '@sentry/nextjs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CRON_NAME = 'youtube-intelligence-watchdog'
const STALE_THRESHOLD_MINUTES = 30

async function handle(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseServiceClient()
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60_000).toISOString()

  const { data: released, error } = await supabase
    .from('youtube_intelligence_tasks')
    .update({
      status: 'stale',
      error_message: `auto-released: running past ${STALE_THRESHOLD_MINUTES}min`,
    })
    .eq('status', 'running')
    .lt('started_at', cutoff)
    .select('id, channel_id')

  if (error) {
    Sentry.captureMessage(`youtube-intelligence-watchdog: ${error.message}`)
    await recordCronFailure(CRON_NAME, error.message).catch((e) => console.error('[cron-health] write failed:', e))
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  await recordCronSuccess(CRON_NAME).catch((e) => console.error('[cron-health] write failed:', e))
  return NextResponse.json({ released: released?.length ?? 0 })
}

export const GET = handle
export const POST = handle
