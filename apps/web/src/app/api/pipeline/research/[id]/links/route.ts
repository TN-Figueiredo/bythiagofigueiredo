import { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { UUID_REGEX } from '@/lib/pipeline/auth'
import { authenticateWrite, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { ResearchLinkSchema } from '@/lib/pipeline/research-schemas'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return pipelineError('VALIDATION_ERROR', 'Invalid research item ID', 400)

  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = ResearchLinkSchema.safeParse(body)
  if (!parsed.success) {
    return pipelineError('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400, auth)
  }

  const supabase = getSupabaseServiceClient()

  const { data: researchItem } = await supabase
    .from('research_items')
    .select('id')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!researchItem) return pipelineError('NOT_FOUND', 'Research item not found', 404, auth)

  const { data: link, error } = await supabase
    .from('research_links')
    .insert({
      research_id: id,
      pipeline_item_id: parsed.data.pipeline_item_id,
      note: parsed.data.note ?? null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return pipelineError('VALIDATION_ERROR', 'Link already exists', 409, auth)
    console.error('[research/links/POST]', error.message)
    return pipelineError('DB_ERROR', 'Failed to create link', 500, auth)
  }

  return pipelineSuccess(link, 201, auth)
}
