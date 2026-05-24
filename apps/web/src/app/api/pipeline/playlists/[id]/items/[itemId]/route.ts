import { type NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticateWrite, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id: playlistId, itemId } = await params

  const supabase = getSupabaseServiceClient()

  const { data: playlist } = await supabase
    .from('playlists')
    .select('id')
    .eq('id', playlistId)
    .eq('site_id', auth.siteId)
    .maybeSingle()
  if (!playlist) return pipelineError('NOT_FOUND', 'Playlist not found', 404, auth)

  const { data: item } = await supabase
    .from('playlist_items')
    .select('id')
    .eq('id', itemId)
    .eq('playlist_id', playlistId)
    .maybeSingle()
  if (!item) return pipelineError('NOT_FOUND', 'Item not found in playlist', 404, auth)

  const { error } = await supabase
    .from('playlist_items')
    .delete()
    .eq('id', itemId)

  if (error) return pipelineError('DB_ERROR', 'Failed to delete playlist item', 500, auth)

  return pipelineSuccess({ deleted: true }, 200, auth)
}
