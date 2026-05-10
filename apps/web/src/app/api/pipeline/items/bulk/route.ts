import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { BulkOperationSchema } from '@/lib/pipeline/schemas'
import { getNextStage, getPreviousStage } from '@/lib/pipeline/workflows'
import type { Format } from '@/lib/pipeline/schemas'

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
  const parsed = BulkOperationSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })

  const supabase = getSupabaseServiceClient()

  // Phase 1: Validate all operations — no writes, collect all errors
  type ValidatedOp = { op: (typeof parsed.data.operations)[number]; writeData?: Record<string, unknown> }
  const validated: ValidatedOp[] = []
  const errors: Array<{ id: string; error: string }> = []

  for (const op of parsed.data.operations) {
    if (op.op === 'advance') {
      const { data: item } = await supabase.from('content_pipeline').select('id, format, stage').eq('id', op.id).eq('site_id', auth.siteId).single()
      if (!item) { errors.push({ id: op.id, error: 'Not found' }); continue }
      const next = getNextStage(item.format as Format, item.stage)
      if (!next) { errors.push({ id: op.id, error: 'Already at final stage' }); continue }
      validated.push({ op, writeData: { stage: next } })
    } else if (op.op === 'retreat') {
      const { data: item } = await supabase.from('content_pipeline').select('id, format, stage').eq('id', op.id).eq('site_id', auth.siteId).single()
      if (!item) { errors.push({ id: op.id, error: 'Not found' }); continue }
      const prev = getPreviousStage(item.format as Format, item.stage)
      if (!prev) { errors.push({ id: op.id, error: 'Already at first stage' }); continue }
      validated.push({ op, writeData: { stage: prev } })
    } else if (op.op === 'archive') {
      validated.push({ op, writeData: { is_archived: true, archived_at: new Date().toISOString() } })
    } else if (op.op === 'restore') {
      validated.push({ op, writeData: { is_archived: false, archived_at: null, archive_reason: null } })
    } else if (op.op === 'tag') {
      const { data: item } = await supabase.from('content_pipeline').select('tags').eq('id', op.id).eq('site_id', auth.siteId).single()
      if (!item) { errors.push({ id: op.id, error: 'Not found' }); continue }
      const toAdd = op.data?.add ?? []
      const toRemove = op.data?.remove ?? []
      const tags = Array.from(new Set([...(item.tags || []), ...toAdd])).filter((t: string) => !toRemove.includes(t))
      validated.push({ op, writeData: { tags } })
    } else if (op.op === 'update') {
      const { data: item } = await supabase.from('content_pipeline').select('version').eq('id', op.id).eq('site_id', auth.siteId).single()
      if (!item) { errors.push({ id: op.id, error: 'Not found' }); continue }
      if (item.version !== op.version) { errors.push({ id: op.id, error: `Version conflict. Current: ${item.version}` }); continue }
      validated.push({ op })
    } else if (op.op === 'move_collection') {
      validated.push({ op })
    }
  }

  // If any validation failed, reject the entire batch
  if (errors.length > 0) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: `${errors.length} operation(s) failed validation`, details: errors } },
      { status: 400 },
    )
  }

  // Phase 2: Execute all writes — all validations passed
  const results: Array<{ id: string; ok: boolean; error?: string }> = []

  for (const { op, writeData } of validated) {
    try {
      if (op.op === 'advance' || op.op === 'retreat' || op.op === 'archive' || op.op === 'restore' || op.op === 'tag') {
        await supabase.from('content_pipeline').update(writeData!).eq('id', op.id).eq('site_id', auth.siteId)
        results.push({ id: op.id, ok: true })
      } else if (op.op === 'update') {
        const { data, error } = await supabase.from('content_pipeline').update(op.data).eq('id', op.id).eq('site_id', auth.siteId).eq('version', op.version).select().single()
        if (error || !data) { results.push({ id: op.id, ok: false, error: 'Version conflict (concurrent modification)' }); continue }
        results.push({ id: op.id, ok: true })
      } else if (op.op === 'move_collection') {
        const { error } = await supabase
          .from('content_pipeline_memberships')
          .upsert({ pipeline_id: op.id, collection_id: op.data.collection_id, position: op.data.position }, { onConflict: 'pipeline_id,collection_id' })
        if (error) { results.push({ id: op.id, ok: false, error: error.message }); continue }
        results.push({ id: op.id, ok: true })
      }
    } catch (err) {
      results.push({ id: op.id, ok: false, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  const allOk = results.every((r) => r.ok)
  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json(
    { data: { results, success_count: results.filter((r) => r.ok).length, failure_count: results.filter((r) => !r.ok).length } },
    { status: allOk ? 200 : 409, headers },
  )
}
