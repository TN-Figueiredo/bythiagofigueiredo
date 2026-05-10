import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { PipelineItemUpdateSchema, FORMAT_METADATA_SCHEMAS } from '@/lib/pipeline/schemas'
import { isValidStage, WORKFLOWS } from '@/lib/pipeline/workflows'
import type { Format } from '@/lib/pipeline/schemas'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid item ID format' } }, { status: 400 })
  }
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult

  const supabase = getSupabaseServiceClient()
  const { data: item, error } = await supabase
    .from('content_pipeline')
    .select('*, content_pipeline_memberships(collection_id, position, role, content_collections(id, code, name, type))')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (error || !item) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, { status: 404 })

  const { data: history } = await supabase
    .from('content_pipeline_history')
    .select('*')
    .eq('pipeline_id', id)
    .order('changed_at', { ascending: false })
    .limit(20)

  const { data: deps } = await supabase
    .from('pipeline_dependencies')
    .select('blocker_id, blocked_id, dependency_type')
    .or(`blocker_id.eq.${id},blocked_id.eq.${id}`)

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({
    data: { ...item, history: history ?? [], dependencies: deps ?? [] },
    meta: { version: item.version, etag: String(item.version), updated_at: item.updated_at },
  }, { headers })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid item ID format' } }, { status: 400 })
  }
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const ifMatch = req.headers.get('If-Match')
  if (!ifMatch) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'If-Match header required' } }, { status: 400 })
  const expectedVersion = parseInt(ifMatch)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }
  const parsed = PipelineItemUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()

  const { data: current } = await supabase
    .from('content_pipeline')
    .select('version, format')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!current) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, { status: 404 })

  if (parsed.data.stage && !isValidStage(current.format as Format, parsed.data.stage)) {
    return NextResponse.json({
      error: { code: 'VALIDATION_ERROR', message: `Stage "${parsed.data.stage}" is not valid for format "${current.format}". Valid stages: ${WORKFLOWS[current.format as Format].map(s => s.stage).join(', ')}` },
    }, { status: 400 })
  }

  if (parsed.data.format_metadata && Object.keys(parsed.data.format_metadata).length > 0) {
    const metaResult = FORMAT_METADATA_SCHEMAS[current.format as Format].safeParse(parsed.data.format_metadata)
    if (!metaResult.success) {
      return NextResponse.json({
        error: { code: 'VALIDATION_ERROR', message: `Invalid format_metadata: ${metaResult.error.issues.map(i => i.message).join(', ')}` },
      }, { status: 400 })
    }
  }

  if (current.version !== expectedVersion) {
    const { data: freshItem } = await supabase.from('content_pipeline').select('*').eq('id', id).single()
    return NextResponse.json({
      error: {
        code: 'VERSION_CONFLICT',
        message: `Version mismatch. Current: ${current.version}`,
        details: { current_version: current.version, your_version: expectedVersion, current_state: freshItem },
      },
    }, { status: 409 })
  }

  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) updateData[key] = value
  }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update(updateData)
    .eq('id', id)
    .eq('version', expectedVersion)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: { code: 'VERSION_CONFLICT', message: 'Concurrent modification detected' } }, { status: 409 })
  }

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({
    data: updated,
    meta: { version: updated.version, etag: String(updated.version), updated_at: updated.updated_at },
  }, { headers })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid item ID format' } }, { status: 400 })
  }
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('content_pipeline')
    .update({ is_archived: true, archived_at: new Date().toISOString(), archive_reason: 'Archived via API' })
    .eq('id', id)
    .eq('site_id', auth.siteId)

  if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })
  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: { archived: true } }, { headers })
}
