import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ is_archived: false, archived_at: null, archive_reason: null })
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .select()
    .single()

  if (error || !updated) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, { status: 404 })

  await supabase.from('content_pipeline_history').insert({
    pipeline_id: id,
    event_type: 'restored',
  })

  return NextResponse.json({ data: updated, meta: { version: updated.version, etag: String(updated.version), updated_at: updated.updated_at } })
}
