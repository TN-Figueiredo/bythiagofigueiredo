import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { z } from 'zod'

const AddMembersSchema = z.object({
  members: z.array(z.object({
    pipeline_id: z.string().uuid(),
    position: z.number().int().default(0),
    role: z.string().max(50).nullable().default(null),
  })).min(1).max(50),
})

const RemoveMemberSchema = z.object({
  pipeline_id: z.string().uuid(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid collection ID format' } }, { status: 400 })
  }
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult

  const supabase = getSupabaseServiceClient()

  const { data: collection } = await supabase
    .from('content_collections')
    .select('id')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!collection) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Collection not found' } }, { status: 404 })

  const { data: members, error } = await supabase
    .from('content_pipeline_memberships')
    .select('pipeline_id, position, role, content_pipeline(id, code, title_pt, title_en, format, stage, priority, tags)')
    .eq('collection_id', id)
    .order('position')

  if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })
  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: members ?? [] }, { headers })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid collection ID format' } }, { status: 400 })
  }
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }
  const parsed = AddMembersSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })

  const supabase = getSupabaseServiceClient()

  const { data: collection } = await supabase
    .from('content_collections')
    .select('id')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!collection) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Collection not found' } }, { status: 404 })

  const toInsert = parsed.data.members.map((m) => ({
    collection_id: id,
    pipeline_id: m.pipeline_id,
    position: m.position,
    role: m.role,
  }))

  const { data, error } = await supabase
    .from('content_pipeline_memberships')
    .upsert(toInsert, { onConflict: 'pipeline_id,collection_id' })
    .select()

  if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })
  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data }, { status: 201, headers })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid collection ID format' } }, { status: 400 })
  }
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }
  const parsed = RemoveMemberSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('content_pipeline_memberships')
    .delete()
    .eq('collection_id', id)
    .eq('pipeline_id', parsed.data.pipeline_id)

  if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })
  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: { removed: true } }, { headers })
}
