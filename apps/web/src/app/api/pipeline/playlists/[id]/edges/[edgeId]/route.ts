import { type NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticateWrite, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; edgeId: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id: playlistId, edgeId } = await params

  const supabase = getSupabaseServiceClient()

  const { data: playlist } = await supabase
    .from('playlists')
    .select('id')
    .eq('id', playlistId)
    .eq('site_id', auth.siteId)
    .maybeSingle()
  if (!playlist) return pipelineError('NOT_FOUND', 'Playlist not found', 404, auth)

  const { data: edge } = await supabase
    .from('playlist_edges')
    .select('id')
    .eq('id', edgeId)
    .eq('playlist_id', playlistId)
    .maybeSingle()
  if (!edge) return pipelineError('NOT_FOUND', 'Edge not found in playlist', 404, auth)

  const { error } = await supabase
    .from('playlist_edges')
    .delete()
    .eq('id', edgeId)

  if (error) return pipelineError('VALIDATION_ERROR', error.message, 400, auth)

  return pipelineSuccess({ deleted: true }, 200, auth)
}
