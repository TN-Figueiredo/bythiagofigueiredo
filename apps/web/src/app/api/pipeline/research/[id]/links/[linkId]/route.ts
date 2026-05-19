import { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { UUID_REGEX } from '@/lib/pipeline/auth'
import { authenticateWrite, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; linkId: string }> }) {
  const { id, linkId } = await params
  if (!UUID_REGEX.test(id) || !UUID_REGEX.test(linkId)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid ID format', 400)
  }

  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const supabase = getSupabaseServiceClient()

  const { data: researchItem } = await supabase
    .from('research_items')
    .select('id')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!researchItem) return pipelineError('NOT_FOUND', 'Research item not found', 404, auth)

  const { error } = await supabase
    .from('research_links')
    .delete()
    .eq('id', linkId)
    .eq('research_id', id)

  if (error) {
    console.error('[research/links/DELETE]', error.message)
    return pipelineError('DB_ERROR', 'Failed to delete link', 500, auth)
  }

  return pipelineSuccess({ deleted: true }, 200, auth)
}
