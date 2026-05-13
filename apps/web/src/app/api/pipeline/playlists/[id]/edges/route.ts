import { type NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { PipelineCreateEdgeSchema } from '@/lib/pipeline/schemas'
import { authenticateWrite, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id: playlistId } = await params

  const supabase = getSupabaseServiceClient()

  const { data: playlist } = await supabase
    .from('playlists')
    .select('id')
    .eq('id', playlistId)
    .eq('site_id', auth.siteId)
    .maybeSingle()
  if (!playlist) return pipelineError('NOT_FOUND', 'Playlist not found', 404, auth)

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = PipelineCreateEdgeSchema.safeParse(body)
  if (!parsed.success) return pipelineError('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400, auth)

  const { source_item_id, target_item_id, edge_type, label } = parsed.data

  if (source_item_id === target_item_id) return pipelineError('VALIDATION_ERROR', 'Self-loops are not allowed', 400, auth)

  const { data: existing } = await supabase
    .from('playlist_edges')
    .select('id')
    .eq('playlist_id', playlistId)
    .eq('source_item_id', source_item_id)
    .eq('target_item_id', target_item_id)
    .eq('edge_type', edge_type)
    .maybeSingle()
  if (existing) return pipelineSuccess({ id: existing.id, already_existed: true }, 200, auth)

  const { data, error } = await supabase
    .from('playlist_edges')
    .insert({ playlist_id: playlistId, source_item_id, target_item_id, edge_type, label: label ?? null })
    .select('id')
    .single()

  if (error) {
    if (error.message.includes('cycle') || error.code === 'P0001') {
      return pipelineError('CYCLE_DETECTED', 'Sequence edge would create a cycle', 422, auth)
    }
    return pipelineError('VALIDATION_ERROR', error.message, 400, auth)
  }

  return pipelineSuccess({ id: data.id, already_existed: false }, 201, auth)
}
