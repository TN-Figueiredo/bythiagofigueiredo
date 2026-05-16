import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { PipelineItemCreateSchema, FORMAT_METADATA_SCHEMAS } from '@/lib/pipeline/schemas'
import { generateCode, DEFAULT_CHECKLISTS, WORKFLOWS, isValidStage } from '@/lib/pipeline/workflows'
import { decodeCursor, encodeCursor, parseSortParam, applyPipelineFilters } from '@/lib/pipeline/queries'
import { sanitizeForFilter } from '@/lib/pipeline/sanitize'
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
    .select('*', { count: 'exact' })
    .eq('site_id', auth.siteId)
    .order(column, { ascending })
    .order('id', { ascending })
    .limit(limit + 1)

  query = applyPipelineFilters(query, {
    format: params.get('format') || undefined,
    stage: params.get('stage') || undefined,
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
      const safeValue = /^[a-zA-Z0-9\-_:.T+Z]+$/.test(decoded.sort_value) && decoded.sort_value.length <= 200
      if (UUID_REGEX.test(decoded.id) && safeValue) {
        const op = ascending ? 'gt' : 'lt'
        const safeSortValue = sanitizeForFilter(decoded.sort_value)
        query = query.or(`${column}.${op}.${safeSortValue},and(${column}.eq.${safeSortValue},id.gt.${decoded.id})`)
      }
    }
  }

  const { data, error, count } = await query
  if (error) {
    console.error('[pipeline/items/GET]', error.message)
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Internal server error' } }, { status: 500 })
  }

  const hasNext = (data?.length ?? 0) > limit
  const items = data?.slice(0, limit) ?? []
  const lastItem = items[items.length - 1]
  const nextCursor = hasNext && lastItem ? encodeCursor(String(lastItem[column as keyof typeof lastItem] ?? ''), lastItem.id) : undefined

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({
    data: items,
    meta: { total: count ?? 0, has_next: hasNext, next_cursor: nextCursor, limit },
  }, { headers })
}

export async function POST(req: NextRequest) {
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
  const isBatch = Array.isArray(body)
  const items = isBatch ? (body as unknown[]) : [body]

  if (items.length > 50) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Max 50 items per batch' } }, { status: 400 })
  }

  const parsed = items.map((item) => PipelineItemCreateSchema.safeParse(item))
  const firstError = parsed.find((p) => !p.success)
  if (firstError && !firstError.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: firstError.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })
  }

  for (const p of parsed) {
    if (!p.success) continue
    const format = p.data.format as Format
    const stage = p.data.stage || 'idea'
    if (!isValidStage(format, stage)) {
      return NextResponse.json({
        error: { code: 'VALIDATION_ERROR', message: `Stage "${stage}" is not valid for format "${format}". Valid stages: ${WORKFLOWS[format].map(s => s.stage).join(', ')}` },
      }, { status: 400 })
    }
    if (p.data.format_metadata && Object.keys(p.data.format_metadata).length > 0) {
      const metaResult = FORMAT_METADATA_SCHEMAS[format].safeParse(p.data.format_metadata)
      if (!metaResult.success) {
        return NextResponse.json({
          error: { code: 'VALIDATION_ERROR', message: `Invalid format_metadata for ${format}: ${metaResult.error.issues.map(i => i.message).join(', ')}` },
        }, { status: 400 })
      }
    }
  }

  const supabase = getSupabaseServiceClient()
  const toInsert = parsed.map((p) => {
    if (!p.success) throw new Error('unreachable')
    const data = p.data
    const format = data.format as Format
    const title = data.title_pt || data.title_en || 'untitled'
    const code = data.code || generateCode(format, title, data.format_metadata)
    const checklist = data.production_checklist || DEFAULT_CHECKLISTS[format]

    return {
      site_id: auth.siteId,
      code,
      title_pt: data.title_pt || null,
      title_en: data.title_en || null,
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

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: isBatch ? inserted : inserted?.[0] }, { status: 201, headers })
}
