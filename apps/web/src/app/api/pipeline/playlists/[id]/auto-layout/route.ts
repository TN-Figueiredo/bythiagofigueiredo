import { type NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getPlaylistGraph } from '@/lib/playlists/queries'
import { computeAutoLayout } from '@/lib/playlists/canvas/auto-layout'
import { authenticateWrite, pipelineError, pipelineSuccess } from '@/lib/pipeline/helpers'
import { withSnapshot } from '@/lib/playlists/snapshot-middleware'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id: playlistId } = await params

  const graph = await getPlaylistGraph(playlistId, auth.siteId)
  if (!graph) return pipelineError('NOT_FOUND', 'Playlist not found', 404, auth)

  return withSnapshot(playlistId, auth.siteId, null, 'pre_destructive', 'API: auto-layout', async () => {
    if (graph.items.length === 0) {
      return pipelineSuccess({ positions: [], layers: 0 }, 200, auth)
    }

    const positions = computeAutoLayout(graph.items, graph.edges)

    const supabase = getSupabaseServiceClient()
    const errors: string[] = []
    await Promise.all(
      positions.map(p =>
        supabase
          .from('playlist_items')
          .update({ position_x: p.x, position_y: p.y })
          .eq('id', p.itemId)
          .eq('playlist_id', playlistId)
          .then(({ error }) => { if (error) errors.push(error.message) }),
      ),
    )

    if (errors.length > 0) return pipelineError('VALIDATION_ERROR', errors[0]!, 400, auth)

    const maxLayer = positions.reduce((max, p) => Math.max(max, p.x), 0)
    const layerCount = positions.length > 0 ? Math.floor(maxLayer / 200) + 1 : 0

    return pipelineSuccess({
      positions: positions.map(p => ({
        item_id: p.itemId,
        position_x: p.x,
        position_y: p.y,
      })),
      layers: layerCount,
    }, 200, auth)
  })
}
