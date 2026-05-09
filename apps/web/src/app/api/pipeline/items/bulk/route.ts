import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import { BulkOperationSchema } from '@/lib/pipeline/schemas'
import { getNextStage, getPreviousStage } from '@/lib/pipeline/workflows'
import type { Format } from '@/lib/pipeline/schemas'

export async function POST(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const body = await req.json()
  const parsed = BulkOperationSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } }, { status: 400 })

  const supabase = getSupabaseServiceClient()
  const results: Array<{ id: string; ok: boolean; error?: string }> = []

  for (const op of parsed.data.operations) {
    try {
      if (op.op === 'advance') {
        const { data: item } = await supabase
          .from('content_pipeline')
          .select('id, format, stage')
          .eq('id', op.id)
          .eq('site_id', auth.siteId)
          .single()
        if (!item) { results.push({ id: op.id, ok: false, error: 'Not found' }); continue }
        const next = getNextStage(item.format as Format, item.stage)
        if (!next) { results.push({ id: op.id, ok: false, error: 'Already at final stage' }); continue }
        await supabase.from('content_pipeline').update({ stage: next }).eq('id', op.id)
        results.push({ id: op.id, ok: true })
      } else if (op.op === 'retreat') {
        const { data: item } = await supabase
          .from('content_pipeline')
          .select('id, format, stage')
          .eq('id', op.id)
          .eq('site_id', auth.siteId)
          .single()
        if (!item) { results.push({ id: op.id, ok: false, error: 'Not found' }); continue }
        const prev = getPreviousStage(item.format as Format, item.stage)
        if (!prev) { results.push({ id: op.id, ok: false, error: 'Already at first stage' }); continue }
        await supabase.from('content_pipeline').update({ stage: prev }).eq('id', op.id)
        results.push({ id: op.id, ok: true })
      } else if (op.op === 'archive') {
        await supabase.from('content_pipeline').update({ is_archived: true, archived_at: new Date().toISOString() }).eq('id', op.id).eq('site_id', auth.siteId)
        results.push({ id: op.id, ok: true })
      } else if (op.op === 'restore') {
        await supabase.from('content_pipeline').update({ is_archived: false, archived_at: null, archive_reason: null }).eq('id', op.id).eq('site_id', auth.siteId)
        results.push({ id: op.id, ok: true })
      } else if (op.op === 'tag') {
        const { data: item } = await supabase.from('content_pipeline').select('tags').eq('id', op.id).eq('site_id', auth.siteId).single()
        if (!item) { results.push({ id: op.id, ok: false, error: 'Not found' }); continue }
        const toAdd = op.data?.add ?? []
        const toRemove = op.data?.remove ?? []
        const tags = Array.from(new Set([...(item.tags || []), ...toAdd])).filter((t: string) => !toRemove.includes(t))
        await supabase.from('content_pipeline').update({ tags }).eq('id', op.id)
        results.push({ id: op.id, ok: true })
      } else if (op.op === 'update') {
        const { error } = await supabase.from('content_pipeline').update(op.data).eq('id', op.id).eq('site_id', auth.siteId)
        if (error) { results.push({ id: op.id, ok: false, error: error.message }); continue }
        results.push({ id: op.id, ok: true })
      } else if (op.op === 'move_collection') {
        const { error } = await supabase
          .from('content_pipeline_memberships')
          .upsert({ item_id: op.id, collection_id: op.data.collection_id, position: op.data.position }, { onConflict: 'item_id,collection_id' })
        if (error) { results.push({ id: op.id, ok: false, error: error.message }); continue }
        results.push({ id: op.id, ok: true })
      }
    } catch (err) {
      results.push({ id: op.id, ok: false, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  const allOk = results.every((r) => r.ok)
  return NextResponse.json({ data: { results, success_count: results.filter((r) => r.ok).length, failure_count: results.filter((r) => !r.ok).length } }, { status: allOk ? 200 : 207 })
}
