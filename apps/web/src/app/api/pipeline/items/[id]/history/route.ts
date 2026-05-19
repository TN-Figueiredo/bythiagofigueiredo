import { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticateRead, pipelineSuccess, pipelineError } from '@/lib/pipeline/helpers'
import { UUID_REGEX } from '@/lib/pipeline/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid item ID format', 400)
  }
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 200)

  const supabase = getSupabaseServiceClient()

  const { data: item } = await supabase
    .from('content_pipeline')
    .select('id')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!item) return pipelineError('NOT_FOUND', 'Item not found', 404, auth)

  const { data: history, error } = await supabase
    .from('content_pipeline_history')
    .select('*')
    .eq('pipeline_id', id)
    .order('changed_at', { ascending: false })
    .limit(limit)

  if (error) return pipelineError('DB_ERROR', 'Failed to load history', 400, auth)

  return pipelineSuccess(history ?? [], 200, auth)
}
