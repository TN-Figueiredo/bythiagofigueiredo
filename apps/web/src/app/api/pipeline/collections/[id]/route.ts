import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { CollectionUpdateSchema } from '@/lib/pipeline/schemas'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid item ID format' } }, { status: 400 })
  }
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })

  const supabase = getSupabaseServiceClient()
  const { data: collection, error } = await supabase
    .from('content_collections')
    .select('*')
    .eq('id', id)
    .eq('site_id', authResult.auth.siteId)
    .single()

  if (error || !collection) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Collection not found' } }, { status: 404 })

  const { data: members } = await supabase
    .from('content_pipeline_memberships')
    .select('position, role, content_pipeline(id, code, title_pt, title_en, format, stage, priority, tags)')
    .eq('collection_id', id)
    .order('position')

  const headers = buildRateLimitHeaders(authResult.auth)
  return NextResponse.json({ data: { ...collection, members: members ?? [] } }, { headers })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid item ID format' } }, { status: 400 })
  }
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  if (!requirePermission(authResult.auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }
  const parsed = CollectionUpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('content_collections')
    .update(parsed.data)
    .eq('id', id)
    .eq('site_id', authResult.auth.siteId)
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Collection not found' } }, { status: 404 })
  const headers = buildRateLimitHeaders(authResult.auth)
  return NextResponse.json({ data }, { headers })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid item ID format' } }, { status: 400 })
  }
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  if (!requirePermission(authResult.auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('content_collections')
    .delete()
    .eq('id', id)
    .eq('site_id', authResult.auth.siteId)

  if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })
  const headers = buildRateLimitHeaders(authResult.auth)
  return NextResponse.json({ data: { deleted: true } }, { headers })
}
