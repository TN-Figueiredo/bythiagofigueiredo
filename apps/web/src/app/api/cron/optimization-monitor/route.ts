import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { buildNotification } from '@/lib/youtube/notification-service'
import { fanOutToSiteAdmins } from '@/lib/notifications/fan-out-to-admins'
import { getIsoWeek } from '@/lib/youtube/analytics-sync'
import { OPTIMIZATION_CONFIG, applyCycleTransition } from '@/lib/youtube/optimization-loop'
import { recordCronSuccess, recordCronFailure } from '@/lib/cron-health'
import * as Sentry from '@sentry/nextjs'

const CRON_NAME = 'optimization-monitor'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const now = new Date()
  const weekIso = getIsoWeek(now)

  const { data: monitoring, error: monitoringError } = await supabase
    .from('optimization_cycles')
    .select('id, youtube_video_id, site_id, test_winner_applied_at, monitoring_day7_at, monitoring_day14_at, monitoring_day30_at')
    .eq('state', 'post_test_monitoring')
    .not('test_winner_applied_at', 'is', null)
    .limit(200)

  // Um erro de query dropado aqui caía em `monitoring === null` ->
  // `!monitoring?.length` -> recordCronSuccess + HTTP 200 — a correção
  // anterior (Importante 3) fechou exatamente esse buraco em
  // sync-analytics-metrics/weekly-grade-snapshot/youtube-intelligence-dispatch/
  // send-welcome-emails, mas reintroduziu o mesmo problema aqui ao adicionar
  // recordCronSuccess sem checar `error` antes. Distinguir "a query falhou"
  // de "não há ciclos a monitorar".
  if (monitoringError) {
    Sentry.captureMessage(`optimization-monitor: monitoring query failed: ${monitoringError.message}`)
    await recordCronFailure(CRON_NAME, monitoringError.message).catch((e) => console.error('[cron-health] write failed:', e))
    return NextResponse.json({ error: 'monitoring query failed', detail: monitoringError.message }, { status: 500 })
  }

  if (!monitoring?.length) {
    await recordCronSuccess(CRON_NAME).catch((e) => console.error('[cron-health] write failed:', e))
    return NextResponse.json({ checked: 0 })
  }

  let checked = 0
  let errors = 0

  for (const cycle of monitoring) {
    try {
      const appliedAt = new Date(cycle.test_winner_applied_at!)
      const daysSinceApplied = Math.floor((now.getTime() - appliedAt.getTime()) / 86400000)

      const { data: video } = await supabase
        .from('youtube_videos')
        .select('title, ctr')
        .eq('id', cycle.youtube_video_id)
        .eq('site_id', cycle.site_id)
        .single()

      const currentCtr = video?.ctr ?? 0

      for (const checkDay of OPTIMIZATION_CONFIG.monitoring_check_days) {
        if (daysSinceApplied >= checkDay) {
          const field = `monitoring_day${checkDay}_at` as keyof typeof cycle
          if (cycle[field]) continue

          const { data: latestGrade } = await supabase
            .from('video_grade_history')
            .select('score, grade')
            .eq('youtube_video_id', cycle.youtube_video_id)
            .eq('site_id', cycle.site_id)
            .order('recorded_at', { ascending: false })
            .limit(1)
            .single()

          const result = { score: latestGrade?.score ?? 0, grade: latestGrade?.grade ?? 'D', ctr: currentCtr }

          await supabase.from('optimization_cycles').update({
            [`monitoring_day${checkDay}_at`]: now.toISOString(),
            [`monitoring_day${checkDay}_result`]: result,
          }).eq('id', cycle.id)

          if (checkDay === 30) {
            const isResolved = latestGrade && (latestGrade.grade === 'A' || latestGrade.grade === 'B')
            if (isResolved) {
              await applyCycleTransition(supabase, cycle.id, 'resolved', { resolved_reason: 'grade_improved' })

              const payload = buildNotification({
                type: 'optimization_resolved',
                videoId: cycle.youtube_video_id,
                videoTitle: video?.title ?? 'Video',
                weekIso,
              })
              await fanOutToSiteAdmins({
                siteId: cycle.site_id,
                domain: 'youtube',
                type: `youtube.${payload.type}`,
                priority: payload.priority,
                title: payload.title,
                message: payload.message,
                dedupKey: payload.dedup_key,
                payload: {
                  ...(payload.video_id ? { videoId: payload.video_id } : {}),
                },
                actionHref: payload.action_href,
              })
            } else {
              await applyCycleTransition(supabase, cycle.id, 'retest_needed', {})

              const payload = buildNotification({
                type: 'retest_suggested',
                videoId: cycle.youtube_video_id,
                videoTitle: video?.title ?? 'Video',
                weekIso,
              })
              await fanOutToSiteAdmins({
                siteId: cycle.site_id,
                domain: 'youtube',
                type: `youtube.${payload.type}`,
                priority: payload.priority,
                title: payload.title,
                message: payload.message,
                dedupKey: payload.dedup_key,
                payload: {
                  ...(payload.video_id ? { videoId: payload.video_id } : {}),
                },
                actionHref: payload.action_href,
              })
            }
          }

          checked++
        }
      }
    } catch (err) {
      errors++
      console.error('[optimization-monitor] Error processing cycle:', err)
      Sentry.captureException(err)
    }
  }

  if (errors > 0 && checked === 0) {
    await recordCronFailure(CRON_NAME, `${errors} cycle(s) failed`).catch((e) => console.error('[cron-health] write failed:', e))
  } else {
    await recordCronSuccess(CRON_NAME).catch((e) => console.error('[cron-health] write failed:', e))
  }

  return NextResponse.json({ checked, errors })
}
