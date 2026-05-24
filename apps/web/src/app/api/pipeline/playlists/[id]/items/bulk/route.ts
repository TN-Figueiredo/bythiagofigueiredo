import { type NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { PipelineBulkAddItemsSchema } from '@/lib/pipeline/schemas'
import { getNextSortOrder } from '@/lib/playlists/queries'
import { authenticateWrite, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { withSnapshot } from '@/lib/playlists/snapshot-middleware'

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

  return withSnapshot(playlistId, auth.siteId, null, 'pre_destructive', `API: bulk add items`, async () => {
    const body = await parseBody(req)
    if (body instanceof Response) return body

    const parsed = PipelineBulkAddItemsSchema.safeParse(body)
    if (!parsed.success) return pipelineError('VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join(', '), 400, auth)

    for (const item of parsed.data.items) {
      const refs = [item.blog_post_id, item.newsletter_edition_id, item.pipeline_id].filter(Boolean)
      if (refs.length !== 1) return pipelineError('VALIDATION_ERROR', 'Each item must have exactly one content reference', 400, auth)
    }

    let nextSort = await getNextSortOrder(playlistId)
    const results: { id: string; already_existed: boolean }[] = []
    const errors: { index: number; code: string; message: string }[] = []
    let added = 0
    let skipped = 0

    for (let i = 0; i < parsed.data.items.length; i++) {
      const item = parsed.data.items[i]!

      let dupQuery = supabase.from('playlist_items').select('id').eq('playlist_id', playlistId)
      if (item.blog_post_id) dupQuery = dupQuery.eq('blog_post_id', item.blog_post_id)
      else if (item.newsletter_edition_id) dupQuery = dupQuery.eq('newsletter_edition_id', item.newsletter_edition_id)
      else if (item.pipeline_id) dupQuery = dupQuery.eq('pipeline_id', item.pipeline_id)

      const { data: existing } = await dupQuery.maybeSingle()
      if (existing) {
        results.push({ id: existing.id, already_existed: true })
        skipped++
        continue
      }

      const resolvedSort = item.sort_order ?? nextSort
      if (!item.sort_order) nextSort += 1000

      const { data, error } = await supabase
        .from('playlist_items')
        .insert({
          playlist_id: playlistId,
          blog_post_id: item.blog_post_id ?? null,
          newsletter_edition_id: item.newsletter_edition_id ?? null,
          pipeline_id: item.pipeline_id ?? null,
          sort_order: resolvedSort,
          position_x: item.position_x ?? 0,
          position_y: item.position_y ?? 0,
        })
        .select('id')
        .single()

      if (error) {
        console.error('[playlist-items/bulk]', error)
        const isFk = error.code === '23503'
        errors.push({
          index: i,
          code: isFk ? 'INVALID_REFERENCE' : 'VALIDATION_ERROR',
          message: isFk ? 'Referenced content does not exist' : 'Failed to insert item',
        })
        continue
      }

      results.push({ id: data.id, already_existed: false })
      added++
    }

    return pipelineSuccess({ items: results, added, skipped, errors }, 200, auth)
  })
}
