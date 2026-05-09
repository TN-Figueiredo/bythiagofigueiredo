import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline } from '@/lib/pipeline/auth'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult

  const format = req.nextUrl.searchParams.get('format')
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('reference_content')
    .select('key, title, content_md, content_compact, version, updated_at')
    .eq('site_id', auth.siteId)
    .order('key')

  if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })

  const mapped = data?.map((d) => ({
    key: d.key,
    title: d.title,
    content: format === 'md' ? d.content_md : d.content_compact ?? d.content_md,
    version: d.version,
    updated_at: d.updated_at,
  }))

  return NextResponse.json({ data: mapped })
}
