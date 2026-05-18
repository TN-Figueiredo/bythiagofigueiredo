import { NextRequest, NextResponse } from 'next/server'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  if (!requirePermission(authResult.auth, 'read')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const status = req.nextUrl.searchParams.get('status') ?? 'pending'
  const supabase = getSupabaseServiceClient()

  const { data: task } = await supabase
    .from('youtube_intelligence_tasks')
    .select('id, site_id, channel_id, trigger_type, requested_at')
    .eq('site_id', authResult.auth.siteId)
    .eq('status', status)
    .order('requested_at', { ascending: true })
    .limit(1)
    .single()

  if (!task) {
    return new NextResponse(null, { status: 204 })
  }

  await supabase.from('youtube_intelligence_tasks').update({
    status: 'running',
    started_at: new Date().toISOString(),
  }).eq('id', task.id)

  const headers = buildRateLimitHeaders(authResult.auth)
  return NextResponse.json(task, { headers: headers ?? {} })
}
