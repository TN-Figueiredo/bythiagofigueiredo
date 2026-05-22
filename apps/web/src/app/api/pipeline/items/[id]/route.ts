import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticateRead, authenticateWrite, pipelineError, parseBody } from '@/lib/pipeline/helpers'
import { buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { PipelineItemUpdateSchema, FORMAT_METADATA_SCHEMAS, FORMATS, type Format } from '@/lib/pipeline/schemas'
import { isValidStage, WORKFLOWS } from '@/lib/pipeline/workflows'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid item ID format', 400)
  }
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const supabase = getSupabaseServiceClient()
  const { data: item, error } = await supabase
    .from('content_pipeline')
    .select('*')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (error || !item) return pipelineError('NOT_FOUND', 'Item not found', 404, auth)

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
    return pipelineError('VALIDATION_ERROR', 'Invalid item ID format', 400)
  }
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const expectedVersionRaw = req.headers.get('X-Expected-Version') ?? req.headers.get('If-Match')
  if (!expectedVersionRaw) return pipelineError('VALIDATION_ERROR', 'X-Expected-Version header required', 400, auth)
  const expectedVersion = parseInt(expectedVersionRaw)

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = PipelineItemUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return pipelineError('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400, auth)
  }

  const supabase = getSupabaseServiceClient()

  const { data: current } = await supabase
    .from('content_pipeline')
    .select('version, format')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!current) return pipelineError('NOT_FOUND', 'Item not found', 404, auth)

  if (!FORMATS.includes(current.format as Format)) {
    return pipelineError('VALIDATION_ERROR', `Unknown format: ${current.format}`, 422, auth)
  }

  if (parsed.data.stage && !isValidStage(current.format as Format, parsed.data.stage)) {
    return pipelineError('VALIDATION_ERROR', `Stage "${parsed.data.stage}" is not valid for format "${current.format}". Valid stages: ${WORKFLOWS[current.format as Format].map(s => s.stage).join(', ')}`, 400, auth)
  }

  if (parsed.data.format_metadata && Object.keys(parsed.data.format_metadata).length > 0) {
    const metaResult = FORMAT_METADATA_SCHEMAS[current.format as Format].safeParse(parsed.data.format_metadata)
    if (!metaResult.success) {
      return pipelineError('VALIDATION_ERROR', `Invalid format_metadata: ${metaResult.error.issues.map(i => i.message).join(', ')}`, 400, auth)
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
    return pipelineError('VERSION_CONFLICT', 'Concurrent modification detected', 409, auth)
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
    return pipelineError('VALIDATION_ERROR', 'Invalid item ID format', 400)
  }
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('content_pipeline')
    .update({ is_archived: true, archived_at: new Date().toISOString(), archive_reason: 'Archived via API' })
    .eq('id', id)
    .eq('site_id', auth.siteId)

  if (error) return pipelineError('DB_ERROR', 'Failed to archive item', 400, auth)

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: { archived: true } }, { headers })
}
