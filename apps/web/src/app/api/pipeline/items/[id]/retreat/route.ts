import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { getPreviousStage } from '@/lib/pipeline/workflows'
import type { Format } from '@/lib/pipeline/schemas'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid item ID format' } }, { status: 400 })
  }
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  const { data: item } = await supabase
    .from('content_pipeline')
    .select('id, format, stage, version')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!item) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, { status: 404 })

  const prevStage = getPreviousStage(item.format as Format, item.stage)
  if (!prevStage) {
    return NextResponse.json({ error: { code: 'INVALID_OPERATION', message: 'Already at first stage' } }, { status: 422 })
  }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ stage: prevStage })
    .eq('id', id)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error?.message ?? 'Update failed' } }, { status: 400 })
  }

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: updated, meta: { version: updated.version, etag: String(updated.version), updated_at: updated.updated_at } }, { headers })
}
