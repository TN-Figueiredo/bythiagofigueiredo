import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { CollectionCreateSchema } from '@/lib/pipeline/schemas'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult

  const type = req.nextUrl.searchParams.get('type')
  const supabase = getSupabaseServiceClient()
  let query = supabase
    .from('content_collections')
    .select('*, content_pipeline_memberships(count)')
    .eq('site_id', auth.siteId)
    .order('position')

  if (type) query = query.eq('type', type)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })
  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data }, { headers })
}

export async function POST(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const body = await req.json()
  const parsed = CollectionCreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('content_collections')
    .insert({ site_id: auth.siteId, ...parsed.data })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Duplicate collection code' } }, { status: 409 })
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })
  }
  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data }, { status: 201, headers })
}
