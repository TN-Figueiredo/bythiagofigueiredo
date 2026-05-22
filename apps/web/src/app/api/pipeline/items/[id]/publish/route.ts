import { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticateWrite, pipelineSuccess, pipelineError, parseBody } from '@/lib/pipeline/helpers'
import { UUID_REGEX } from '@/lib/pipeline/auth'
import { z } from 'zod'

const PublishBodySchema = z.object({
  targetStage: z.enum(['published', 'scheduled']),
  scheduledFor: z.string().datetime().nullable().optional(),
  vvsScore: z.number().int().min(0).max(110),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return pipelineError('VALIDATION_ERROR', 'Invalid item ID format', 400)
  }

  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = PublishBodySchema.safeParse(body)
  if (!parsed.success) {
    return pipelineError('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400, auth)
  }

  const { targetStage, scheduledFor, vvsScore } = parsed.data

  if (vvsScore < 80) {
    return pipelineError('VALIDATION_ERROR', 'VVS score must be at least 80 to publish', 422, auth)
  }
  if (targetStage === 'scheduled' && !scheduledFor) {
    return pipelineError('VALIDATION_ERROR', 'scheduledFor is required for scheduled stage', 422, auth)
  }

  const supabase = getSupabaseServiceClient()

  const { data: item } = await supabase
    .from('content_pipeline')
    .select('id, format, blog_post_id, site_id, version')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .maybeSingle()

  if (!item) return pipelineError('NOT_FOUND', 'Pipeline item not found', 404, auth)
  if (item.format !== 'blog_post') {
    return pipelineError('INVALID_OPERATION', 'Publish action is only available for blog_post format', 422, auth)
  }
  if (!item.blog_post_id) {
    return pipelineError('INVALID_OPERATION', 'Pipeline item must be graduated to a blog post first', 422, auth)
  }

  const { data: blogPost } = await supabase
    .from('blog_posts')
    .select('id, status')
    .eq('id', item.blog_post_id)
    .eq('site_id', auth.siteId)
    .maybeSingle()

  if (!blogPost) return pipelineError('NOT_FOUND', 'Linked blog post not found', 404, auth)

  const VALID_TRANSITIONS: Record<string, string[]> = {
    draft: ['published', 'scheduled'],
    scheduled: ['published'],
  }

  const allowed = VALID_TRANSITIONS[blogPost.status as string] ?? []
  if (!allowed.includes(targetStage)) {
    return pipelineError(
      'INVALID_OPERATION',
      `Cannot transition blog post from "${blogPost.status}" to "${targetStage}"`,
      422,
      auth,
    )
  }

  const patch: Record<string, unknown> = { status: targetStage }
  if (targetStage === 'published') {
    patch.published_at = new Date().toISOString()
  }
  if (targetStage === 'scheduled') {
    patch.scheduled_for = scheduledFor
  }

  const { error: updateError } = await supabase
    .from('blog_posts')
    .update(patch)
    .eq('id', item.blog_post_id)
    .eq('site_id', auth.siteId)
    .eq('status', blogPost.status)

  if (updateError) {
    return pipelineError('DB_ERROR', `Failed to update blog post: ${updateError.message}`, 500, auth)
  }

  // Advance pipeline item stage
  await supabase
    .from('content_pipeline')
    .update({ stage: targetStage, version: item.version + 1 })
    .eq('id', id)
    .eq('version', item.version)

  await supabase.from('content_pipeline_history').insert({
    pipeline_id: id,
    event_type: 'stage_changed',
    from_value: item.format,
    to_value: targetStage,
    changed_by: null,
  })

  return pipelineSuccess({ ok: true, targetStage, blogPostId: item.blog_post_id }, 200, auth)
}
