import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid item ID format' } }, { status: 400 })
  }
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 200)

  const supabase = getSupabaseServiceClient()

  const { data: item } = await supabase
    .from('content_pipeline')
    .select('id')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!item) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, { status: 404 })

  const { data: history, error } = await supabase
    .from('content_pipeline_history')
    .select('*')
    .eq('pipeline_id', id)
    .order('changed_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: history ?? [] }, { headers })
}
