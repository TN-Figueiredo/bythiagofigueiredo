import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { getSectionKey, SectionPatchSchema } from '@/lib/pipeline/sections'
import type { SectionData } from '@/lib/pipeline/sections'

type RouteParams = { params: Promise<{ id: string; section: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id, section } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid item ID' } }, { status: 400 })
  }

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })

  const lang = req.nextUrl.searchParams.get('lang') || 'en'
  const sectionKey = getSectionKey(section, lang)

  const supabase = getSupabaseServiceClient()
  const { data: item, error } = await supabase
    .from('content_pipeline')
    .select('id, format, language, version, sections')
    .eq('id', id)
    .eq('site_id', authResult.auth.siteId)
    .single()

  if (error || !item) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, { status: 404 })

  const sections = (item.sections ?? {}) as Record<string, SectionData>
  const sectionData = sections[sectionKey] ?? null

  const headers = buildRateLimitHeaders(authResult.auth)
  return NextResponse.json({
    data: sectionData,
    meta: { section_key: sectionKey, item_version: item.version, exists: sectionData !== null },
  }, { headers })
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id, section } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid item ID' } }, { status: 400 })
  }

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  if (!requirePermission(authResult.auth, 'write')) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })
  }

  const expectedVersionRaw = req.headers.get('X-Expected-Version') ?? req.headers.get('If-Match')
  if (!expectedVersionRaw) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Expected-Version header required' } }, { status: 400 })
  }
  const expectedVersion = parseInt(expectedVersionRaw)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON' } }, { status: 400 })
  }

  const parsed = SectionPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid request body' } }, { status: 400 })
  }

  const lang = req.nextUrl.searchParams.get('lang') || 'en'
  const sectionKey = getSectionKey(section, lang)

  const supabase = getSupabaseServiceClient()

  const { data: item, error: fetchError } = await supabase
    .from('content_pipeline')
    .select('id, version, sections')
    .eq('id', id)
    .eq('site_id', authResult.auth.siteId)
    .single()

  if (fetchError || !item) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, { status: 404 })
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
    return NextResponse.json({ error: { code: 'CONFLICT', message: 'Concurrent update detected' } }, { status: 409 })
  }

  const headers = buildRateLimitHeaders(authResult.auth)
  return NextResponse.json({
    data: updatedSection,
    meta: { section_key: sectionKey, item_version: updated.version },
  }, { headers })
}
