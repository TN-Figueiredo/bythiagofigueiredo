import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import { PipelineItemCreateSchema } from '@/lib/pipeline/schemas'
import { generateCode, DEFAULT_CHECKLISTS } from '@/lib/pipeline/workflows'
import { decodeCursor, encodeCursor, parseSortParam, applyPipelineFilters } from '@/lib/pipeline/queries'
import type { Format } from '@/lib/pipeline/schemas'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'read')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const params = req.nextUrl.searchParams
  const limit = Math.min(parseInt(params.get('limit') || '50'), 200)
  const cursorParam = params.get('cursor') || undefined
  const { column, ascending } = parseSortParam(params.get('sort') || undefined)

  const supabase = getSupabaseServiceClient()
  let query = supabase
    .from('content_pipeline')
    .select('*, content_pipeline_memberships(collection_id)', { count: 'exact' })
    .eq('site_id', auth.siteId)
    .order(column, { ascending })
    .order('id', { ascending })
    .limit(limit + 1)

  query = applyPipelineFilters(query, {
    format: params.get('format') || undefined,
    stage: params.get('stage') || undefined,
    collection: params.get('collection') || undefined,
    lang: params.get('lang') || undefined,
    archived: params.get('archived') || undefined,
    priority_min: params.get('priority_min') || undefined,
    priority_max: params.get('priority_max') || undefined,
    tag: params.get('tag') || undefined,
    parent_id: params.get('parent_id') || undefined,
    graduated: params.get('graduated') || undefined,
    assigned_to: params.get('assigned_to') || undefined,
    stale_days: params.get('stale_days') || undefined,
    search: params.get('search') || undefined,
  })

  if (cursorParam) {
    const decoded = decodeCursor(cursorParam)
    if (decoded) {
      const op = ascending ? 'gt' : 'lt'
      query = query.or(`${column}.${op}.${decoded.sort_value},and(${column}.eq.${decoded.sort_value},id.gt.${decoded.id})`)
    }
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })

  const hasNext = (data?.length ?? 0) > limit
  const items = data?.slice(0, limit) ?? []
  const lastItem = items[items.length - 1]
  const nextCursor = hasNext && lastItem ? encodeCursor(String(lastItem[column as keyof typeof lastItem] ?? ''), lastItem.id) : undefined

  return NextResponse.json({
    data: items,
    meta: { total: count ?? 0, has_next: hasNext, next_cursor: nextCursor, limit },
  })
}

export async function POST(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const body = await req.json()
  const isBatch = Array.isArray(body)
  const items = isBatch ? body : [body]

  if (items.length > 50) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Max 50 items per batch' } }, { status: 400 })
  }

  const parsed = items.map((item) => PipelineItemCreateSchema.safeParse(item))
  const firstError = parsed.find((p) => !p.success)
  if (firstError && !firstError.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: firstError.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()
  const toInsert = parsed.map((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (p as any).data
    const format = data.format as Format
    const title = data.title_pt || data.title_en || 'untitled'
    const code = data.code || generateCode(format, title, data.format_metadata)
    const checklist = data.production_checklist || DEFAULT_CHECKLISTS[format]

    return {
      site_id: auth.siteId,
      code,
      title_pt: data.title_pt || null,
      title_en: data.title_en || null,
      slug: data.slug || null,
      format,
      stage: data.stage || 'idea',
      language: data.language,
      priority: data.priority,
      parent_id: data.parent_id || null,
      hook: data.hook || null,
      synopsis: data.synopsis || null,
      body_content: data.body_content || null,
      format_metadata: data.format_metadata,
      production_checklist: checklist,
      tags: data.tags,
      assigned_to: data.assigned_to || null,
    }
  })

  const { data: inserted, error } = await supabase
    .from('content_pipeline')
    .insert(toInsert)
    .select()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Duplicate code. Please use a unique code.' } }, { status: 409 })
    }
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 })
  }

  return NextResponse.json({ data: isBatch ? inserted : inserted?.[0] }, { status: 201 })
}
