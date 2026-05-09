import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import { getNextStage, isFinalStage } from '@/lib/pipeline/workflows'
import { computeValidationScore } from '@/lib/pipeline/validation'
import type { Format } from '@/lib/pipeline/schemas'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const ifMatch = req.headers.get('If-Match')
  if (!ifMatch) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'If-Match header required' } }, { status: 400 })
  const expectedVersion = parseInt(ifMatch)

  const supabase = getSupabaseServiceClient()
  const { data: item } = await supabase
    .from('content_pipeline')
    .select('id, format, stage, version, site_id, title_pt, title_en, hook, synopsis, body_content, tags, production_checklist, format_metadata')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!item) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, { status: 404 })
  if (item.version !== expectedVersion) {
    return NextResponse.json({ error: { code: 'VERSION_CONFLICT', message: `Version mismatch. Current: ${item.version}` } }, { status: 409 })
  }

  const format = item.format as Format
  const nextStage = getNextStage(format, item.stage)
  if (!nextStage) {
    return NextResponse.json({ error: { code: 'INVALID_OPERATION', message: 'Already at final stage' } }, { status: 422 })
  }

  const { data: deps } = await supabase
    .from('pipeline_dependencies')
    .select('blocker_id, dependency_type')
    .eq('blocked_id', id)
    .eq('dependency_type', 'hard')

  if (deps && deps.length > 0) {
    const { data: blockers } = await supabase
      .from('content_pipeline')
      .select('id, code, format, stage')
      .in('id', deps.map((d) => d.blocker_id))

    const unresolved = blockers?.filter((b) => !isFinalStage(b.format as Format, b.stage))
    if (unresolved && unresolved.length > 0) {
      return NextResponse.json({
        error: { code: 'DEPENDENCY_BLOCKED', message: 'Hard dependencies not resolved', details: { blockers: unresolved } },
      }, { status: 409 })
    }
  }

  const { data: softDeps } = await supabase
    .from('pipeline_dependencies')
    .select('blocker_id, dependency_type')
    .eq('blocked_id', id)
    .eq('dependency_type', 'soft')

  let warnings: string[] = []
  if (softDeps && softDeps.length > 0) {
    const { data: softBlockers } = await supabase
      .from('content_pipeline')
      .select('id, code, format, stage')
      .in('id', softDeps.map((d) => d.blocker_id))

    const pending = softBlockers?.filter((b) => !isFinalStage(b.format as Format, b.stage))
    if (pending && pending.length > 0) {
      warnings = pending.map((b) => `Soft dependency "${b.code}" still at stage "${b.stage}"`)
    }
  }

  const updateData: Record<string, unknown> = { stage: nextStage }
  if (isFinalStage(format, nextStage)) {
    updateData.published_at = new Date().toISOString()
  }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update(updateData)
    .eq('id', id)
    .eq('version', expectedVersion)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: { code: 'VERSION_CONFLICT', message: 'Concurrent modification' } }, { status: 409 })
  }

  const { count: membershipsCount } = await supabase
    .from('content_pipeline_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('pipeline_id', id)

  const score = computeValidationScore({
    title_pt: updated.title_pt,
    title_en: updated.title_en,
    hook: updated.hook,
    synopsis: updated.synopsis,
    body_content: updated.body_content,
    tags: updated.tags || [],
    production_checklist: updated.production_checklist || [],
    format_metadata: updated.format_metadata || {},
    memberships_count: membershipsCount ?? 0,
    format,
  })

  await supabase.from('content_pipeline').update({ validation_score: score }).eq('id', id)

  return NextResponse.json({
    data: { ...updated, validation_score: score },
    meta: { version: updated.version, etag: String(updated.version), updated_at: updated.updated_at },
    ...(warnings.length > 0 ? { warnings } : {}),
  })
}
