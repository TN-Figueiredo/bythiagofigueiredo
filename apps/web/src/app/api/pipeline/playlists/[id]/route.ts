import { type NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getPlaylistGraph } from '@/lib/playlists/queries'
import { PipelineUpdatePlaylistSchema } from '@/lib/pipeline/schemas'
import { authenticateRead, authenticateWrite, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { withSnapshot } from '@/lib/playlists/snapshot-middleware'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id } = await params

  const graph = await getPlaylistGraph(id, auth.siteId)
  if (!graph) return pipelineError('NOT_FOUND', 'Playlist not found', 404, auth)

  return pipelineSuccess({
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
  }, 200, auth)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id } = await params

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = PipelineUpdatePlaylistSchema.safeParse(body)
  if (!parsed.success) return pipelineError('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400, auth)

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('playlists')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .select('*')
    .single()

  if (error || !data) return pipelineError('NOT_FOUND', 'Playlist not found', 404, auth)

  return pipelineSuccess({
    id: data.id,
    name_en: data.name_en,
    name_pt: data.name_pt,
    slug: data.slug,
    status: data.status,
    category: data.category,
    description_en: data.description_en,
    description_pt: data.description_pt,
    cover_image_url: data.cover_image_url,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }, 200, auth)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result
  const { id } = await params

  const supabase = getSupabaseServiceClient()

  return withSnapshot(id, auth.siteId, null, 'pre_destructive', 'API: antes de deletar playlist', async () => {
    const { data } = await supabase
      .from('playlists')
      .delete()
      .eq('id', id)
      .eq('site_id', auth.siteId)
      .select('id')
      .maybeSingle()

    if (!data) return pipelineError('NOT_FOUND', 'Playlist not found', 404, auth)

    return pipelineSuccess({ deleted: true }, 200, auth)
  })
}
