import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticateWrite, pipelineError, parseBody } from '@/lib/pipeline/helpers'
import { buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { ChecklistToggleSchema } from '@/lib/pipeline/schemas'

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

  const parsed = ChecklistToggleSchema.safeParse(body)
  if (!parsed.success) return pipelineError('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400, auth)

  const { index, done } = parsed.data
  const supabase = getSupabaseServiceClient()

  const { data: item } = await supabase
    .from('content_pipeline')
    .select('id, production_checklist, version')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (!item) return pipelineError('NOT_FOUND', 'Item not found', 404, auth)

  const checklist = [...((item.production_checklist ?? []) as Array<{ label: string; done: boolean; toggled_at?: string }>)]
  if (index >= checklist.length) return pipelineError('VALIDATION_ERROR', 'Index out of bounds', 400, auth)

  const current = checklist[index]!
  checklist[index] = { label: current.label, done, toggled_at: new Date().toISOString() }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ production_checklist: checklist })
    .eq('id', id)
    .select()
    .single()

  if (error) return pipelineError('DB_ERROR', 'Failed to update checklist', 400, auth)

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({ data: updated, meta: { version: updated.version, etag: String(updated.version), updated_at: updated.updated_at } }, { headers })
}
