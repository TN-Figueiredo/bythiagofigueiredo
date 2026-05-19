import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticateRead, authenticateWrite, pipelineError, parseBody } from '@/lib/pipeline/helpers'
import { buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { getSectionKey, SectionPatchSchema } from '@/lib/pipeline/sections'
import type { SectionData } from '@/lib/pipeline/sections'

type RouteParams = { params: Promise<{ id: string; section: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id, section } = await params
  if (!UUID_REGEX.test(id)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid item ID', 400)
  }

  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const lang = req.nextUrl.searchParams.get('lang') || 'en'
  const sectionKey = getSectionKey(section, lang)

  const supabase = getSupabaseServiceClient()
  const { data: item, error } = await supabase
    .from('content_pipeline')
    .select('id, format, language, version, sections')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (error || !item) return pipelineError('NOT_FOUND', 'Item not found', 404, auth)

  const sections = (item.sections ?? {}) as Record<string, SectionData>
  const sectionData = sections[sectionKey] ?? null

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({
    data: sectionData,
    meta: { section_key: sectionKey, item_version: item.version, exists: sectionData !== null },
  }, { headers })
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id, section } = await params
  if (!UUID_REGEX.test(id)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid item ID', 400)
  }

  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const expectedVersionRaw = req.headers.get('X-Expected-Version') ?? req.headers.get('If-Match')
  if (!expectedVersionRaw) {
    return pipelineError('VALIDATION_ERROR', 'X-Expected-Version header required', 400, auth)
  }
  const expectedVersion = parseInt(expectedVersionRaw)

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = SectionPatchSchema.safeParse(body)
  if (!parsed.success) {
    return pipelineError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid request body', 400, auth)
  }

  const lang = req.nextUrl.searchParams.get('lang') || 'en'
  const sectionKey = getSectionKey(section, lang)

  const supabase = getSupabaseServiceClient()

  const { data: item, error: fetchError } = await supabase
    .from('content_pipeline')
    .select('id, version, sections')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (fetchError || !item) return pipelineError('NOT_FOUND', 'Item not found', 404, auth)
  if (item.version !== expectedVersion) {
    return NextResponse.json({
      error: { code: 'PRECONDITION_FAILED', message: 'Version mismatch', expected: expectedVersion, current: item.version },
    }, { status: 412 })
  }

  const sections = (item.sections ?? {}) as Record<string, SectionData>
  const existing = sections[sectionKey]
  if (existing && existing.rev !== parsed.data.rev) {
    return NextResponse.json({ error: { code: 'CONFLICT', message: 'Section revision mismatch', expected_rev: parsed.data.rev, current_rev: existing.rev } }, { status: 409 })
  }

  const newRev = (existing?.rev ?? 0) + 1
  const updatedSection: SectionData = {
    rev: newRev,
    cowork_rev: existing?.cowork_rev ?? null,
    source: parsed.data.source ?? existing?.source ?? 'user',
    edited: (parsed.data.source ?? 'user') === 'user' || existing?.edited === true,
    content: parsed.data.content,
    updated_at: new Date().toISOString(),
    modified_by: parsed.data.modified_by ?? null,
  }

  const newSections = { ...sections, [sectionKey]: updatedSection }

  const { data: updated, error: updateError } = await supabase
    .from('content_pipeline')
    .update({
      sections: newSections,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('version', expectedVersion)
    .select('version')
    .single()

  if (updateError || !updated) {
    return pipelineError('CONFLICT', 'Concurrent update detected', 409, auth)
  }

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({
    data: updatedSection,
    meta: { section_key: sectionKey, item_version: updated.version },
  }, { headers })
}
