import { NextResponse, type NextRequest } from 'next/server'
import { authenticatePipeline, getRateLimitHeaders } from '@/lib/pipeline/auth'
import { getPlaylistGraph } from '@/lib/playlists/queries'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { auth } = authResult
  const headers = auth.keyHash ? getRateLimitHeaders(auth.keyHash) : {}
  const { id } = await params

  const graph = await getPlaylistGraph(id, auth.siteId)
  if (!graph) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers })
  }

  return NextResponse.json({
    data: {
      playlist: {
        id: graph.playlist.id,
        name_pt: graph.playlist.name_pt,
        name_en: graph.playlist.name_en,
        slug: graph.playlist.slug,
        status: graph.playlist.status,
        category: graph.playlist.category,
        description_pt: graph.playlist.description_pt,
        description_en: graph.playlist.description_en,
        cover_image_url: graph.playlist.cover_image_url,
        created_at: graph.playlist.created_at,
        updated_at: graph.playlist.updated_at,
      },
      items: graph.items.map(i => ({
        id: i.id,
        title: i.title,
        content_type: i.content_type,
        status: i.status,
        category: i.category,
        metadata: i.metadata,
        position_x: i.position_x,
        position_y: i.position_y,
        sort_order: i.sort_order,
        is_ghost: i.is_ghost,
        other_playlist_count: i.other_playlist_count,
      })),
      edges: graph.edges.map(e => ({
        id: e.id,
        source_item_id: e.source_item_id,
        target_item_id: e.target_item_id,
        edge_type: e.edge_type,
        label: e.label,
      })),
    },
  }, { headers })
}
