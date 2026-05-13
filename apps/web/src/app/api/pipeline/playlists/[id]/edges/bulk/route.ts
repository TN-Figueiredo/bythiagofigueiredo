import { type NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { PipelineBulkCreateEdgesSchema } from '@/lib/pipeline/schemas'
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

  const parsed = PipelineBulkCreateEdgesSchema.safeParse(body)
  if (!parsed.success) return pipelineError('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400, auth)

  const results: { id: string; already_existed: boolean }[] = []
  const errors: { index: number; source_item_id: string; target_item_id: string; code: string; message: string }[] = []
  let created = 0
  let skipped = 0

  for (let i = 0; i < parsed.data.edges.length; i++) {
    const edge = parsed.data.edges[i]!

    if (edge.source_item_id === edge.target_item_id) {
      errors.push({ index: i, source_item_id: edge.source_item_id, target_item_id: edge.target_item_id, code: 'VALIDATION_ERROR', message: 'Self-loops are not allowed' })
      continue
    }

    const { data: existing } = await supabase
      .from('playlist_edges')
      .select('id')
      .eq('playlist_id', playlistId)
      .eq('source_item_id', edge.source_item_id)
      .eq('target_item_id', edge.target_item_id)
      .eq('edge_type', edge.edge_type)
      .maybeSingle()

    if (existing) {
      results.push({ id: existing.id, already_existed: true })
      skipped++
      continue
    }

    const { data, error } = await supabase
      .from('playlist_edges')
      .insert({
        playlist_id: playlistId,
        source_item_id: edge.source_item_id,
        target_item_id: edge.target_item_id,
        edge_type: edge.edge_type,
        label: edge.label ?? null,
      })
      .select('id')
      .single()

    if (error) {
      const isCycle = error.message.includes('cycle') || error.code === 'P0001'
      errors.push({
        index: i,
        source_item_id: edge.source_item_id,
        target_item_id: edge.target_item_id,
        code: isCycle ? 'CYCLE_DETECTED' : 'VALIDATION_ERROR',
        message: isCycle ? 'Sequence edge would create a cycle' : error.message,
      })
      continue
    }

    results.push({ id: data.id, already_existed: false })
    created++
  }

  return pipelineSuccess({ edges: results, created, skipped, errors }, 200, auth)
}
