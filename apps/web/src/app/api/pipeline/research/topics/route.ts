import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { ResearchTopicCreateSchema } from '@/lib/pipeline/research-schemas'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'read')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  const { data: topics, error } = await supabase
    .from('research_topics')
    .select('id, parent_id, name, slug, path, depth, color, icon, sort_order, created_at, updated_at')
    .eq('site_id', auth.siteId)
    .order('depth')
    .order('sort_order')

  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: topics ?? [] }, { headers })
}

export async function POST(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }

  const parsed = ResearchTopicCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()
  const { name, slug, parent_id, color, icon } = parsed.data

  let parentPath = ''
  let depth = 0

  if (parent_id) {
    const { data: parent } = await supabase
      .from('research_topics')
      .select('path, depth')
      .eq('id', parent_id)
      .eq('site_id', auth.siteId)
      .single()

    if (!parent) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Parent topic not found' } }, { status: 404 })
    if (parent.depth >= 2) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Max 3 levels (depth 0-2). Parent is already at max depth.' } }, { status: 400 })

    parentPath = parent.path
    depth = parent.depth + 1
  }

  const path = parentPath ? `${parentPath}/${slug}` : slug

  const { data: topic, error } = await supabase
    .from('research_topics')
    .insert({ site_id: auth.siteId, name, slug, path, depth, parent_id: parent_id ?? null, color, icon })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Topic with this path already exists' } }, { status: 409 })
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
  }

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: topic }, { status: 201, headers })
}
