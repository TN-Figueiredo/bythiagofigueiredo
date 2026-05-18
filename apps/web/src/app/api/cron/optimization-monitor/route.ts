import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { buildNotification } from '@/lib/youtube/notification-service'
import { getIsoWeek } from '@/lib/youtube/analytics-sync'
import { OPTIMIZATION_CONFIG } from '@/lib/youtube/optimization-loop'
import * as Sentry from '@sentry/nextjs'

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

  const { data: monitoring } = await supabase
    .from('optimization_cycles')
    .select('id, youtube_video_id, site_id, test_winner_applied_at, monitoring_day7_at, monitoring_day14_at, monitoring_day30_at')
    .eq('state', 'post_test_monitoring')
    .not('test_winner_applied_at', 'is', null)

  if (!monitoring?.length) return NextResponse.json({ checked: 0 })

  let checked = 0

  for (const cycle of monitoring) {
    try {
      const appliedAt = new Date(cycle.test_winner_applied_at!)
      const daysSinceApplied = Math.floor((now.getTime() - appliedAt.getTime()) / 86400000)

      const { data: video } = await supabase
        .from('youtube_videos')
        .select('title, ctr')
        .eq('id', cycle.youtube_video_id)
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
              await supabase.from('optimization_cycles').update({
                state: 'resolved',
                resolved_at: now.toISOString(),
                resolved_reason: 'grade_improved',
              }).eq('id', cycle.id)

              const payload = buildNotification({
                type: 'optimization_resolved',
                videoId: cycle.youtube_video_id,
                videoTitle: video?.title ?? 'Video',
                weekIso,
              })
              await supabase.rpc('create_yt_notification', {
                p_site_id: cycle.site_id,
                p_type: payload.type,
                p_priority: payload.priority,
                p_title: payload.title,
                p_message: payload.message,
                p_dedup_key: payload.dedup_key,
                p_video_id: payload.video_id ?? null,
                p_action_href: payload.action_href ?? null,
              })
            } else {
              await supabase.from('optimization_cycles').update({
                state: 'retest_needed',
                cooldown_until: new Date(now.getTime() + OPTIMIZATION_CONFIG.cooldown_days * 86400000).toISOString(),
              }).eq('id', cycle.id)

              const payload = buildNotification({
                type: 'retest_suggested',
                videoId: cycle.youtube_video_id,
                videoTitle: video?.title ?? 'Video',
                weekIso,
              })
              await supabase.rpc('create_yt_notification', {
                p_site_id: cycle.site_id,
                p_type: payload.type,
                p_priority: payload.priority,
                p_title: payload.title,
                p_message: payload.message,
                p_dedup_key: payload.dedup_key,
                p_video_id: payload.video_id ?? null,
                p_action_href: payload.action_href ?? null,
              })
            }
          }

          checked++
        }
      }
    } catch (err) {
      console.error('[optimization-monitor] Error processing cycle:', err)
      Sentry.captureException(err)
    }
  }

  return NextResponse.json({ checked })
}
