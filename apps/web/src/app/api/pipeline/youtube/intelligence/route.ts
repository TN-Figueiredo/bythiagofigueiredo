import { NextRequest, NextResponse } from 'next/server'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  if (!requirePermission(authResult.auth, 'read')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const channelId = req.nextUrl.searchParams.get('channel_id')
  if (!channelId) return NextResponse.json({ error: 'channel_id required' }, { status: 400 })

  const supabase = getSupabaseServiceClient()
  const siteId = authResult.auth.siteId

  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('id, channel_id, name, subscriber_count')
    .eq('id', channelId)
    .eq('site_id', siteId)
    .single()

  if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

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

  const headers = buildRateLimitHeaders(authResult.auth)
  return NextResponse.json(response, { headers: headers ?? {} })
}

const RecommendationSchema = z.object({
  video_id: z.string().uuid(),
  action_type: z.enum([
    'thumbnail_test', 'title_test', 'description_test', 'combo_test',
    'retention_fix', 'seo_optimization', 'engagement_boost', 'distribution_expand',
    'content_series', 'publish_timing', 'community_post', 'end_screen_optimize',
  ]),
  priority: z.enum(['high', 'medium', 'low']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(500),
  suggested_variant_description: z.string().max(200).optional(),
})

const CoachingSchema = z.object({
  summary: z.string().max(500),
  priorities: z.array(z.object({
    axis: z.enum(['ctr', 'retention', 'reach', 'engagement', 'growth', 'sub_impact']),
    score: z.number().min(0).max(10),
    diagnosis: z.string().max(300),
    action: z.string().max(300),
  })).max(6),
})

const NotificationSchema = z.object({
  type: z.enum([
    'grade_drop', 'ctr_drop', 'monitoring_alert', 'ab_test_completed',
    'retest_suggested', 'optimization_available', 'trending_viral', 'optimization_resolved',
  ]),
  video_id: z.string().uuid().optional(),
  priority: z.number().int().min(1).max(5),
  title: z.string().max(100),
  message: z.string().max(500),
})

const PatchPayloadSchema = z.object({
  task_id: z.string().uuid(),
  video_recommendations: z.array(RecommendationSchema).max(25).optional(),
  coaching: CoachingSchema.optional(),
  notifications: z.array(NotificationSchema).max(20).optional(),
  channel_insights: z.object({
    patterns_detected: z.array(z.object({
      pattern_id: z.string(),
      category: z.string(),
      finding: z.string().max(300),
      confidence: z.number().min(0).max(1),
      sample_size: z.number().int(),
    })).optional(),
    analysis_text: z.string().max(2000).optional(),
  }).optional(),
})

export async function PATCH(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  if (!requirePermission(authResult.auth, 'write')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = PatchPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({
      error: 'validation_failed',
      details: parsed.error.issues.map(i => ({ path: i.path.join('.'), code: i.code, message: i.message })),
    }, { status: 422 })
  }

  const { task_id, video_recommendations, coaching, notifications, channel_insights } = parsed.data
  const supabase = getSupabaseServiceClient()
  const siteId = authResult.auth.siteId

  const { data: task } = await supabase
    .from('youtube_intelligence_tasks')
    .select('id, channel_id, status')
    .eq('id', task_id)
    .eq('site_id', siteId)
    .single()

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  if (task.status !== 'running') {
    return NextResponse.json({ error: `Task status is '${task.status}', expected 'running'` }, { status: 409 })
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
      await supabase.from('youtube_intelligence').upsert({
        site_id: siteId,
        channel_id: task.channel_id,
        video_id: rec.video_id,
        type: 'video',
        recommendations: rec,
        source: 'cowork',
        generated_at: new Date().toISOString(),
      }, { onConflict: 'site_id,channel_id,video_id,source' })

      const { data: cycle } = await supabase
        .from('optimization_cycles')
        .select('id, state')
        .eq('youtube_video_id', rec.video_id)
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
    await supabase.from('youtube_intelligence').upsert({
      site_id: siteId,
      channel_id: task.channel_id,
      video_id: null,
      type: 'channel',
      coaching: coaching ?? null,
      patterns_detected: channel_insights?.patterns_detected ?? null,
      analysis_text: channel_insights?.analysis_text ?? null,
      source: 'cowork',
      generated_at: new Date().toISOString(),
    }, { onConflict: 'site_id,channel_id,source' })
  }

  if (notifications?.length) {
    const weekIso = new Date().toISOString().split('T')[0]!.replace(/-/g, '').slice(0, 6)
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

  const headers = buildRateLimitHeaders(authResult.auth)
  return NextResponse.json({ status: 'ok', processed: true }, { headers: headers ?? {} })
}
