import { NextRequest, NextResponse } from 'next/server'
import { buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { authenticateRead } from '@/lib/pipeline/helpers'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const status = req.nextUrl.searchParams.get('status') ?? 'pending'
  const supabase = getSupabaseServiceClient()

  const { data: task } = await supabase
    .from('youtube_intelligence_tasks')
    .select('id, site_id, channel_id, trigger_type, requested_at')
    .eq('site_id', auth.siteId)
    .eq('status', status)
    .order('requested_at', { ascending: true })
    .limit(1)
    .single()

  if (!task) {
    return new NextResponse(null, { status: 204 })
  }

  const { data: claimed } = await supabase.from('youtube_intelligence_tasks').update({
    status: 'running',
    started_at: new Date().toISOString(),
  }).eq('id', task.id).eq('status', 'pending').select('id').maybeSingle()

  if (!claimed) {
    return new NextResponse(null, { status: 204 })
  }

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json(task, { headers: headers ?? {} })
}
