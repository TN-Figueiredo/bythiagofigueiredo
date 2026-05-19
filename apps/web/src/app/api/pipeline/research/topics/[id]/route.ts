import { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { UUID_REGEX } from '@/lib/pipeline/auth'
import { authenticateWrite, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { ResearchTopicUpdateSchema } from '@/lib/pipeline/research-schemas'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return pipelineError('VALIDATION_ERROR', 'Invalid topic ID', 400)

  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = ResearchTopicUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return pipelineError('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400, auth)
  }

  const supabase = getSupabaseServiceClient()
  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) updateData[key] = value
  }

  if (Object.keys(updateData).length === 0) {
    return pipelineError('VALIDATION_ERROR', 'No fields to update', 400, auth)
  }

  const { data: updated, error } = await supabase
    .from('research_topics')
    .update(updateData)
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .select()
    .single()

  if (error || !updated) return pipelineError('NOT_FOUND', 'Topic not found', 404, auth)

  return pipelineSuccess(updated, 200, auth)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return pipelineError('VALIDATION_ERROR', 'Invalid topic ID', 400)

  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('research_topics')
    .delete()
    .eq('id', id)
    .eq('site_id', auth.siteId)

  if (error) {
    console.error('[research/topics/DELETE]', error.message)
    return pipelineError('DB_ERROR', 'Failed to delete topic', 500, auth)
  }

  return pipelineSuccess({ deleted: true }, 200, auth)
}
