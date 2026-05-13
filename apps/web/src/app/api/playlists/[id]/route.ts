import { NextResponse, type NextRequest } from 'next/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { getPlaylistGraph } from '@/lib/playlists/queries'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { siteId } = await getSiteContext()
    const graph = await getPlaylistGraph(id, siteId)

    if (!graph) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    return NextResponse.json({
      id: graph.playlist.id,
      name_pt: graph.playlist.name_pt,
      name_en: graph.playlist.name_en,
      slug: graph.playlist.slug,
      status: graph.playlist.status,
      category: graph.playlist.category,
      item_count: graph.items.length,
      edge_count: graph.edges.length,
      items: graph.items.map(i => ({
        id: i.id,
        title: i.title,
        content_type: i.content_type,
        status: i.status,
        position_x: i.position_x,
        position_y: i.position_y,
        is_ghost: i.is_ghost,
      })),
      edges: graph.edges.map(e => ({
        id: e.id,
        source_item_id: e.source_item_id,
        target_item_id: e.target_item_id,
        edge_type: e.edge_type,
        label: e.label,
      })),
    })
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
}
