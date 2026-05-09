import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import { getPreviousStage } from '@/lib/pipeline/workflows'
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
    .select('id, format, stage, version')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!item) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, { status: 404 })
  if (item.version !== expectedVersion) {
    return NextResponse.json({ error: { code: 'VERSION_CONFLICT', message: `Version mismatch. Current: ${item.version}` } }, { status: 409 })
  }

  const prevStage = getPreviousStage(item.format as Format, item.stage)
  if (!prevStage) {
    return NextResponse.json({ error: { code: 'INVALID_OPERATION', message: 'Already at first stage' } }, { status: 422 })
  }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ stage: prevStage })
    .eq('id', id)
    .eq('version', expectedVersion)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: { code: 'VERSION_CONFLICT', message: 'Concurrent modification' } }, { status: 409 })
  }

  return NextResponse.json({ data: updated, meta: { version: updated.version, etag: String(updated.version), updated_at: updated.updated_at } })
}
