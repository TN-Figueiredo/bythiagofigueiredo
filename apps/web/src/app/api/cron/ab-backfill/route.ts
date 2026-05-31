import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { fetchAnalyticsForDateRange } from '@/lib/youtube/ab-youtube'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'

export const maxDuration = 120

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  // Get cycles that need backfilling (ended 3+ days ago)
  const { data: cycles } = await supabase
    .from('ab_test_cycles')
    .select('*')
    .in('backfill_status', ['pending', 'partial'])
    .not('ended_at', 'is', null)
    .lt('ended_at', threeDaysAgo)

  if (!cycles || cycles.length === 0) {
    return Response.json({ status: 'ok', backfilled: 0 })
  }

  let backfilled = 0
  let errors = 0

  for (const cycle of cycles) {
    try {
      // Get the parent test and video info
      const { data: test } = await supabase
        .from('ab_tests')
        .select('id, site_id, youtube_video_id')
        .eq('id', cycle.test_id)
        .single()

      if (!test) continue

      const { data: video } = await supabase
        .from('youtube_videos')
        .select('youtube_video_id')
        .eq('id', test.youtube_video_id)
        .single()

      if (!video?.youtube_video_id) continue

      const { accessToken } = await ensureFreshToken(test.site_id, 'youtube')

      const startDate = (cycle.started_at as string).substring(0, 10)
      const endDate = (cycle.ended_at as string).substring(0, 10)

      const rows = await fetchAnalyticsForDateRange(
        video.youtube_video_id,
        startDate,
        endDate,
        accessToken
      )

      if (rows.length === 0) {
        const attempts = (cycle.backfill_attempts ?? 0) + 1
        await supabase
          .from('ab_test_cycles')
          .update({
            backfill_status: attempts >= 3 ? 'no_data' : 'partial',
            backfill_attempts: attempts,
          })
          .eq('id', cycle.id)
        continue
      }

      const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0)
      const weightedCtr = totalImpressions > 0
        ? rows.reduce((s, r) => s + r.impressions * r.ctr, 0) / totalImpressions
        : 0
      const totalClicks = Math.round(totalImpressions * weightedCtr)

      await supabase
        .from('ab_test_cycles')
        .update({
          impressions: totalImpressions,
          clicks: totalClicks,
          ctr: weightedCtr,
          backfill_status: 'confirmed',
        })
        .eq('id', cycle.id)

      backfilled++
    } catch (err) {
      errors++
      Sentry.captureException(err, {
        tags: { cron: 'ab-backfill' },
        extra: { cycleId: cycle.id, testId: cycle.test_id },
      })
      await supabase
        .from('ab_test_cycles')
        .update({ backfill_status: 'error' })
        .eq('id', cycle.id)
    }
  }

  if (errors === 0) {
    await recordCronSuccess('ab-backfill', 'critical')
  } else {
    await recordCronFailure('ab-backfill', `${errors} cycle(s) failed`, 'critical')
  }

  return Response.json({ status: 'ok', backfilled, errors })
}
