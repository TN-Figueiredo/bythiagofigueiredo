import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { authenticateRead, authenticateWrite, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { ResearchItemUpdateSchema } from '@/lib/pipeline/research-schemas'

interface ResearchItemWithTopic {
  id: string
  title: string
  topic_id: string
  content_json: unknown
  content_md: string | null
  summary: string | null
  sources: unknown
  status: string
  word_count: number | null
  version: number
  created_at: string
  updated_at: string
  site_id: string
  research_topics: { path: string; name: string; icon: string | null } | null
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return pipelineError('VALIDATION_ERROR', 'Invalid item ID', 400)

  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const supabase = getSupabaseServiceClient()
  const { data: item, error } = await supabase
    .from('research_items')
    .select('*, research_topics!inner(path, name, icon)')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (error || !item) return pipelineError('NOT_FOUND', 'Research item not found', 404, auth)

  // Supabase client is untyped (no generated DB types); cast to known shape
  const typedItem = item as unknown as ResearchItemWithTopic

  const { data: links } = await supabase
    .from('research_links')
    .select('id, pipeline_item_id, note, created_at, content_pipeline(id, title_pt, title_en, format, stage)')
    .eq('research_id', id)

  const linkedItems = (links ?? []).map((l: any) => ({
    link_id: l.id,
    pipeline_item_id: l.pipeline_item_id,
    note: l.note,
    title: l.content_pipeline?.title_pt ?? l.content_pipeline?.title_en ?? '',
    format: l.content_pipeline?.format,
    stage: l.content_pipeline?.stage,
  }))

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({
    data: {
      id: typedItem.id,
      title: typedItem.title,
      topic_id: typedItem.topic_id,
      topic_path: typedItem.research_topics?.path,
      topic_name: typedItem.research_topics?.name,
      topic_icon: typedItem.research_topics?.icon,
      content_json: typedItem.content_json,
      content_md: typedItem.content_md,
      summary: typedItem.summary,
      sources: typedItem.sources,
      status: typedItem.status,
      word_count: typedItem.word_count,
      version: typedItem.version,
      created_at: typedItem.created_at,
      updated_at: typedItem.updated_at,
      linked_items: linkedItems,
    },
    meta: { version: typedItem.version, updated_at: typedItem.updated_at },
  }, { headers })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return pipelineError('VALIDATION_ERROR', 'Invalid item ID', 400)

  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const expectedVersionRaw = req.headers.get('X-Expected-Version') ?? req.headers.get('If-Match')
  if (!expectedVersionRaw) return pipelineError('VALIDATION_ERROR', 'X-Expected-Version header required', 400, auth)
  const expectedVersion = parseInt(expectedVersionRaw)

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = ResearchItemUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return pipelineError('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400, auth)
  }

  const supabase = getSupabaseServiceClient()

  const { data: current } = await supabase
    .from('research_items')
    .select('version')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!current) return pipelineError('NOT_FOUND', 'Item not found', 404, auth)

  if (current.version !== expectedVersion) {
    return NextResponse.json({
      error: {
        code: 'VERSION_CONFLICT',
        message: `Version mismatch. Current: ${current.version}, yours: ${expectedVersion}`,
        details: { current_version: current.version, your_version: expectedVersion },
      },
    }, { status: 409 })
  }

  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) updateData[key] = value
  }

  if (parsed.data.content_md !== undefined && !parsed.data.content_json) {
    updateData.content_json = null
  }

  const { data: updated, error } = await supabase
    .from('research_items')
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
    meta: { version: updated.version, updated_at: updated.updated_at },
  }, { headers })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return pipelineError('VALIDATION_ERROR', 'Invalid item ID', 400)

  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('research_items')
    .delete()
    .eq('id', id)
    .eq('site_id', auth.siteId)

  if (error) {
    console.error('[research/DELETE]', error.message)
    return pipelineError('DB_ERROR', 'Failed to delete research item', 500, auth)
  }

  return pipelineSuccess({ deleted: true }, 200, auth)
}
