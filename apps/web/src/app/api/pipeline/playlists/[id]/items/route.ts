import { type NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { PipelineAddItemSchema } from '@/lib/pipeline/schemas'
import { getNextSortOrder } from '@/lib/playlists/queries'
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

  const parsed = PipelineAddItemSchema.safeParse(body)
  if (!parsed.success) return pipelineError('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400, auth)

  const { blog_post_id, newsletter_edition_id, pipeline_id, sort_order, position_x, position_y } = parsed.data

  // Check for duplicate
  let dupQuery = supabase.from('playlist_items').select('id').eq('playlist_id', playlistId)
  if (blog_post_id) dupQuery = dupQuery.eq('blog_post_id', blog_post_id)
  else if (newsletter_edition_id) dupQuery = dupQuery.eq('newsletter_edition_id', newsletter_edition_id)
  else if (pipeline_id) dupQuery = dupQuery.eq('pipeline_id', pipeline_id)

  const { data: existing } = await dupQuery.maybeSingle()
  if (existing) return pipelineSuccess({ id: existing.id, already_existed: true }, 200, auth)

  const resolvedSortOrder = sort_order ?? (await getNextSortOrder(playlistId))

  const { data, error } = await supabase
    .from('playlist_items')
    .insert({
      playlist_id: playlistId,
      blog_post_id: blog_post_id ?? null,
      newsletter_edition_id: newsletter_edition_id ?? null,
      pipeline_id: pipeline_id ?? null,
      sort_order: resolvedSortOrder,
      position_x: position_x ?? 0,
      position_y: position_y ?? 0,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23503') return pipelineError('VALIDATION_ERROR', 'Referenced content does not exist', 400, auth)
    return pipelineError('DB_ERROR', 'Failed to create playlist item', 500, auth)
  }

  return pipelineSuccess({ id: data.id, already_existed: false }, 201, auth)
}
