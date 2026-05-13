import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, buildRateLimitHeaders } from '@/lib/pipeline/auth'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult

  const format = req.nextUrl.searchParams.get('format')
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('reference_content')
    .select('key, title, content_md, content_compact, ref_group, sort_order, version, updated_at')
    .eq('site_id', auth.siteId)
    .order('ref_group').order('sort_order').order('key')

  if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })

  const mapped = data?.map((d) => ({
    key: d.key,
    title: d.title,
    content: format === 'md' ? d.content_md : d.content_compact ?? d.content_md,
    ref_group: d.ref_group,
    sort_order: d.sort_order,
    version: d.version,
    updated_at: d.updated_at,
  }))

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: mapped }, { headers })
}
