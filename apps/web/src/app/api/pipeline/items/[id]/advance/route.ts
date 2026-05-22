import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticateWrite, pipelineError } from '@/lib/pipeline/helpers'
import { buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { getNextStage, isFinalStage } from '@/lib/pipeline/workflows'
import { computeValidationScore, VVS_PUBLISH_THRESHOLD } from '@/lib/pipeline/validation'
import { FORMATS, type Format } from '@/lib/pipeline/schemas'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid item ID format', 400)
  }
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const supabase = getSupabaseServiceClient()
  const { data: item } = await supabase
    .from('content_pipeline')
    .select('id, format, stage, version, site_id, title_pt, title_en, hook, synopsis, body_content, tags, production_checklist, format_metadata, validation_score')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!item) return pipelineError('NOT_FOUND', 'Item not found', 404, auth)

  if (!FORMATS.includes(item.format as Format)) {
    return pipelineError('VALIDATION_ERROR', `Unknown format: ${item.format}`, 422, auth)
  }
  const format: Format = item.format as Format
  const nextStage = getNextStage(format, item.stage)
  if (!nextStage) {
    return pipelineError('INVALID_OPERATION', 'Already at final stage', 422, auth)
  }

  if (nextStage === 'ready' && format === 'blog_post') {
    const currentScore = item.validation_score ?? 0
    if (currentScore < VVS_PUBLISH_THRESHOLD) {
      return NextResponse.json(
        { ok: false, error: 'VVS_BELOW_THRESHOLD', message: 'Score de validação insuficiente (mínimo 80%)' },
        { status: 400 },
      )
    }
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

    const unresolved = blockers?.filter((b) => FORMATS.includes(b.format as Format) && !isFinalStage(b.format as Format, b.stage))
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

    const pending = softBlockers?.filter((b) => FORMATS.includes(b.format as Format) && !isFinalStage(b.format as Format, b.stage))
    if (pending && pending.length > 0) {
      warnings = pending.map((b) => `Soft dependency "${b.code}" still at stage "${b.stage}"`)
    }
  }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ stage: nextStage })
    .eq('id', id)
    .select()
    .single()

  if (error || !updated) {
    return pipelineError('DB_ERROR', 'Failed to advance item', 400, auth)
  }

  const score = computeValidationScore({
    title_pt: updated.title_pt,
    title_en: updated.title_en,
    hook: updated.hook,
    synopsis: updated.synopsis,
    body_content: updated.body_content,
    tags: updated.tags || [],
    production_checklist: updated.production_checklist || [],
    format_metadata: updated.format_metadata || {},
    format,
  })

  await supabase.from('content_pipeline').update({ validation_score: score }).eq('id', id)

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({
    data: { ...updated, validation_score: score },
    meta: { version: updated.version, etag: String(updated.version), updated_at: updated.updated_at },
    ...(warnings.length > 0 ? { warnings } : {}),
  }, { headers })
}
