import { NextResponse } from 'next/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { pollVideoStats, shouldSkipPoll, getLastPollTime, insertPollData } from '@/lib/youtube/ab-polls'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const testId = searchParams.get('testId')
  if (!testId) return NextResponse.json({ error: 'testId required' }, { status: 400 })

  // Auth: user must have edit access to the site
  let siteId: string
  try {
    const ctx = await getSiteContext()
    siteId = ctx.siteId
    const auth = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
    if (!auth.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'config_missing' }, { status: 500 })

  // Dedup guard: skip if polled less than 5min ago
  const lastPoll = await getLastPollTime(supabase, testId)
  if (shouldSkipPoll(lastPoll)) {
    return NextResponse.json({ skipped: true, lastPoll })
  }

  // Get test + video (scoped to site)
  const { data: test } = await supabase
    .from('ab_tests')
    .select('id, youtube_video_id, site_id, status')
    .eq('id', testId)
    .eq('site_id', siteId)
    .eq('status', 'active')
    .single()

  if (!test) {
    return NextResponse.json({ error: 'test_not_found_or_inactive' }, { status: 404 })
  }

  // Get the YouTube video ID (the external YT ID, not our internal UUID)
  const { data: video } = await supabase
    .from('youtube_videos')
    .select('youtube_video_id')
    .eq('id', test.youtube_video_id)
    .single()

  if (!video?.youtube_video_id) {
    return NextResponse.json({ error: 'no_youtube_id' }, { status: 404 })
  }

  // Poll YouTube Data API
  const stats = await pollVideoStats(video.youtube_video_id, apiKey)
  if (!stats) return NextResponse.json({ error: 'youtube_unavailable' }, { status: 502 })

  // Get the currently active variant (the non-original one in the open cycle)
  const { data: openCycle } = await supabase
    .from('ab_test_cycles')
    .select('variant_id')
    .eq('test_id', testId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const variantId = openCycle?.variant_id
  if (variantId) {
    await insertPollData(supabase, testId, variantId, stats.views, stats.likes, 'client')
  }

  return NextResponse.json({
    views: stats.views,
    likes: stats.likes,
    polledAt: new Date().toISOString(),
  })
}
