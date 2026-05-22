import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticateWrite, pipelineError } from '@/lib/pipeline/helpers'
import { buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { getPreviousStage } from '@/lib/pipeline/workflows'
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
    .select('id, format, stage, version')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!item) return pipelineError('NOT_FOUND', 'Item not found', 404, auth)

  if (!FORMATS.includes(item.format as Format)) {
    return pipelineError('VALIDATION_ERROR', `Unknown format: ${item.format}`, 422, auth)
  }
  const prevStage = getPreviousStage(item.format as Format, item.stage)
  if (!prevStage) {
    return pipelineError('INVALID_OPERATION', 'Already at first stage', 422, auth)
  }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ stage: prevStage })
    .eq('id', id)
    .select()
    .single()

  if (error || !updated) {
    return pipelineError('DB_ERROR', 'Failed to retreat item', 400, auth)
  }

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: updated, meta: { version: updated.version, etag: String(updated.version), updated_at: updated.updated_at } }, { headers })
}
