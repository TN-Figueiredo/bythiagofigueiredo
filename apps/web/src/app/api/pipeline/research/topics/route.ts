import { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticateRead, authenticateWrite, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { ResearchTopicCreateSchema } from '@/lib/pipeline/research-schemas'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const supabase = getSupabaseServiceClient()
  const { data: topics, error } = await supabase
    .from('research_topics')
    .select('id, parent_id, name, slug, path, depth, color, icon, sort_order, created_at, updated_at')
    .eq('site_id', auth.siteId)
    .order('depth')
    .order('sort_order')

  if (error) {
    console.error('[research/topics/GET]', error.message)
    return pipelineError('DB_ERROR', 'Failed to load topics', 500, auth)
  }

  return pipelineSuccess(topics ?? [], 200, auth)
}

export async function POST(req: NextRequest) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = ResearchTopicCreateSchema.safeParse(body)
  if (!parsed.success) {
    return pipelineError('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400, auth)
  }

  const supabase = getSupabaseServiceClient()
  const { name, slug, parent_id, color, icon } = parsed.data

  let parentPath = ''
  let depth = 0

  if (parent_id) {
    const { data: parent } = await supabase
      .from('research_topics')
      .select('path, depth')
      .eq('id', parent_id)
      .eq('site_id', auth.siteId)
      .single()

    if (!parent) return pipelineError('NOT_FOUND', 'Parent topic not found', 404, auth)
    if (parent.depth >= 2) return pipelineError('VALIDATION_ERROR', 'Max 3 levels (depth 0-2). Parent is already at max depth.', 400, auth)

    parentPath = parent.path
    depth = parent.depth + 1
  }

  const path = parentPath ? `${parentPath}/${slug}` : slug

  const { data: topic, error } = await supabase
    .from('research_topics')
    .insert({ site_id: auth.siteId, name, slug, path, depth, parent_id: parent_id ?? null, color, icon })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return pipelineError('VALIDATION_ERROR', 'Topic with this path already exists', 409, auth)
    console.error('[research/topics/POST]', error.message)
    return pipelineError('DB_ERROR', 'Failed to create topic', 500, auth)
  }

  return pipelineSuccess(topic, 201, auth)
}
