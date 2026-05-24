import { type NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { PipelineReorderSchema } from '@/lib/pipeline/schemas'
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

  const parsed = PipelineReorderSchema.safeParse(body)
  if (!parsed.success) return pipelineError('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400, auth)

  const { data: items } = await supabase
    .from('playlist_items')
    .select('id')
    .eq('playlist_id', playlistId)
    .in('id', parsed.data.item_ids)

  const foundIds = new Set((items ?? []).map(i => (i as { id: string }).id))
  const missing = parsed.data.item_ids.filter(id => !foundIds.has(id))
  if (missing.length > 0) return pipelineError('VALIDATION_ERROR', `Items not found in playlist: ${missing.join(', ')}`, 400, auth)

  const errors: string[] = []
  await Promise.all(
    parsed.data.item_ids.map((id, index) =>
      supabase
        .from('playlist_items')
        .update({ sort_order: (index + 1) * 1000 })
        .eq('id', id)
        .eq('playlist_id', playlistId)
        .then(({ error }) => { if (error) errors.push(error.code ?? 'unknown') }),
    ),
  )

  if (errors.length > 0) return pipelineError('DB_ERROR', 'Failed to reorder items', 500, auth)

  return pipelineSuccess({ reordered: true, count: parsed.data.item_ids.length }, 200, auth)
}
