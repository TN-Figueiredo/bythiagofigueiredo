import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticateWrite, pipelineError } from '@/lib/pipeline/helpers'
import { buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid item ID format', 400)
  }
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const supabase = getSupabaseServiceClient()
  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ is_archived: false, archived_at: null, archive_reason: null })
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .select()
    .single()

  if (error || !updated) return pipelineError('NOT_FOUND', 'Item not found', 404, auth)

  await supabase.from('content_pipeline_history').insert({
    pipeline_id: id,
    event_type: 'restored',
  })

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: updated, meta: { version: updated.version, etag: String(updated.version), updated_at: updated.updated_at } }, { headers })
}
