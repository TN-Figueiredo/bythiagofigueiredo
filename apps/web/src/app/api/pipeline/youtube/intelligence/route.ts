import { NextRequest, NextResponse } from 'next/server'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authenticateRead, authenticateWrite, pipelineError, parseBody } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getIsoWeek } from '@/lib/youtube/analytics-sync'
import { PatchPayloadSchema } from '@/lib/youtube/intelligence-schemas'
import * as Sentry from '@sentry/nextjs'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const channelId = req.nextUrl.searchParams.get('channel_id')
  if (!channelId) return pipelineError('VALIDATION_ERROR', 'channel_id required', 400, auth)

  const supabase = getSupabaseServiceClient()
  const siteId = auth.siteId

  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('id, channel_id, name, subscriber_count')
    .eq('id', channelId)
    .eq('site_id', siteId)
    .single()

  if (!channel) return pipelineError('NOT_FOUND', 'Channel not found', 404, auth)

  const { data: videos } = await supabase
    .from('youtube_videos')
    .select('id, youtube_video_id, title, thumbnail_url, published_at, view_count, ctr, impressions, avg_view_percentage, avg_view_duration_seconds, retention_curve, traffic_sources')
    .eq('channel_id', channel.id)
    .order('published_at', { ascending: false })
    .limit(50)

  const { data: gradeHistory } = await supabase
    .from('video_grade_history')
    .select('youtube_video_id, grade, score, ctr, retention, reach, engagement, growth, sub_impact, week_iso')
    .eq('site_id', siteId)
    .order('week_iso', { ascending: false })
    .limit(200)

  const { data: cycles } = await supabase
    .from('optimization_cycles')
    .select('*')
    .eq('site_id', siteId)
    .not('state', 'in', '("resolved","exhausted")')

  const { data: abTests } = await supabase
    .from('ab_tests')
    .select('id, youtube_video_id, name, status, test_type, winner_variant_id, completed_reason, config')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: intelligence } = await supabase
    .from('youtube_intelligence')
    .select('*')
    .eq('channel_id', channel.id)
    .order('generated_at', { ascending: false })
    .limit(50)

  const response = {
    channel: {
      id: channel.id,
      channel_id: channel.channel_id,
      name: channel.name,
      subscriber_count: channel.subscriber_count,
    },
    videos: (videos ?? []).map(v => ({
      id: v.id,
      video_id: v.youtube_video_id,
      title: v.title,
      thumbnail_url: v.thumbnail_url,
      published_at: v.published_at,
      view_count: v.view_count,
      ctr: v.ctr,
      impressions: v.impressions,
      avg_view_percentage: v.avg_view_percentage,
      retention_curve: v.retention_curve,
      traffic_sources: v.traffic_sources,
    })),
    grade_history: gradeHistory ?? [],
    optimization_cycles: cycles ?? [],
    ab_tests: abTests ?? [],
    intelligence: intelligence ?? [],
  }

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json(response, { headers: headers ?? {} })
}

export async function PATCH(req: NextRequest) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = PatchPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({
      error: 'validation_failed',
      details: parsed.error.issues.map(i => ({ path: i.path.join('.'), code: i.code, message: i.message })),
    }, { status: 422 })
  }

  const { task_id, video_recommendations, coaching, notifications, channel_insights } = parsed.data
  const supabase = getSupabaseServiceClient()
  const siteId = auth.siteId

  const { data: task } = await supabase
    .from('youtube_intelligence_tasks')
    .select('id, channel_id, status')
    .eq('id', task_id)
    .eq('site_id', siteId)
    .single()

  if (!task) return pipelineError('NOT_FOUND', 'Task not found', 404, auth)
  if (task.status !== 'running') {
    return pipelineError('VERSION_CONFLICT', `Task status is '${task.status}', expected 'running'`, 409, auth)
  }

  if (video_recommendations?.length) {
    const videoIds = video_recommendations.map(r => r.video_id)
    const { data: existing } = await supabase
      .from('youtube_videos')
      .select('id')
      .eq('channel_id', task.channel_id)
      .in('id', videoIds)

    const existingIds = new Set((existing ?? []).map(v => v.id))
    const missing = videoIds.filter(id => !existingIds.has(id))
    if (missing.length > 0) {
      return NextResponse.json({
        error: 'validation_failed',
        details: missing.map(id => ({ path: `video_recommendations[].video_id`, code: 'referential_integrity', message: `Video ${id} not found` })),
      }, { status: 422 })
    }

    for (const rec of video_recommendations) {
      const { data: existingIntel } = await supabase
        .from('youtube_intelligence')
        .select('id')
        .eq('site_id', siteId)
        .eq('channel_id', task.channel_id)
        .eq('video_id', rec.video_id)
        .eq('source', 'cowork')
        .maybeSingle()

      const intelPayload = {
        site_id: siteId,
        channel_id: task.channel_id,
        video_id: rec.video_id,
        type: 'video' as const,
        recommendations: rec,
        source: 'cowork',
        generated_at: new Date().toISOString(),
      }

      if (existingIntel) {
        const { error } = await supabase.from('youtube_intelligence').update(intelPayload).eq('id', existingIntel.id)
        if (error) Sentry.captureMessage(`intelligence update failed: ${error.message}`, { extra: { videoId: rec.video_id } })
      } else {
        const { error } = await supabase.from('youtube_intelligence').insert(intelPayload)
        if (error) Sentry.captureMessage(`intelligence insert failed: ${error.message}`, { extra: { videoId: rec.video_id } })
      }

      const { data: cycle } = await supabase
        .from('optimization_cycles')
        .select('id, state')
        .eq('youtube_video_id', rec.video_id)
        .eq('site_id', siteId)
        .eq('state', 'flagged')
        .single()

      if (cycle) {
        await supabase.from('optimization_cycles').update({
          state: 'diagnosed',
          diagnosed_at: new Date().toISOString(),
          diagnosis_summary: rec.reasoning,
        }).eq('id', cycle.id)
      }
    }
  }

  if (coaching || channel_insights) {
    const { data: existingChannel } = await supabase
      .from('youtube_intelligence')
      .select('id')
      .eq('site_id', siteId)
      .eq('channel_id', task.channel_id)
      .is('video_id', null)
      .eq('source', 'cowork')
      .maybeSingle()

    const channelPayload = {
      site_id: siteId,
      channel_id: task.channel_id,
      video_id: null,
      type: 'channel' as const,
      coaching: coaching ?? null,
      patterns_detected: channel_insights?.patterns_detected ?? null,
      analysis_text: channel_insights?.analysis_text ?? null,
      source: 'cowork',
      generated_at: new Date().toISOString(),
    }

    if (existingChannel) {
      const { error } = await supabase.from('youtube_intelligence').update(channelPayload).eq('id', existingChannel.id)
      if (error) Sentry.captureMessage(`channel intelligence update failed: ${error.message}`)
    } else {
      const { error } = await supabase.from('youtube_intelligence').insert(channelPayload)
      if (error) Sentry.captureMessage(`channel intelligence insert failed: ${error.message}`)
    }
  }

  if (notifications?.length) {
    const weekIso = getIsoWeek(new Date())
    for (const n of notifications) {
      const dedupKey = `cowork:${n.type}:${n.video_id ?? 'channel'}:${weekIso}`
      await supabase.rpc('create_yt_notification', {
        p_site_id: siteId,
        p_type: n.type,
        p_priority: n.priority,
        p_title: n.title,
        p_message: n.message,
        p_dedup_key: dedupKey,
        p_video_id: n.video_id ?? null,
      })
    }
  }

  await supabase.from('youtube_intelligence_tasks').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
    result_summary: { recommendations: video_recommendations?.length ?? 0, has_coaching: !!coaching },
  }).eq('id', task_id)

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ status: 'ok', processed: true }, { headers: headers ?? {} })
}
