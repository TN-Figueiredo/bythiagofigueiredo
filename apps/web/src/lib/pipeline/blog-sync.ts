import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function syncPipelineOnPostStatusChange(
  postId: string,
  newStatus: string,
  oldStatus: string,
): Promise<void> {
  const svc = getSupabaseServiceClient()

  const { data: item } = await svc
    .from('content_pipeline')
    .select('id, stage, version')
    .eq('blog_post_id', postId)
    .maybeSingle()

  if (!item) return

  // Publish: advance pipeline item to 'published'
  if (newStatus === 'published' && item.stage !== 'published') {
    const { data: updated, error } = await svc
      .from('content_pipeline')
      .update({ stage: 'published' })
      .eq('id', item.id)
      .eq('version', item.version)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[blog-sync] Failed to advance pipeline item', item.id, error)
      return
    }

    if (!updated) {
      console.warn('[blog-sync] CAS conflict: pipeline item', item.id, 'was modified concurrently')
      return
    }

    await svc.from('content_pipeline_history').insert({
      pipeline_id: item.id,
      event_type: 'stage_changed',
      from_value: item.stage,
      to_value: 'published',
      changed_by: null,
    })
    return
  }

  // Unpublish: retreat pipeline item to previous stage
  if (oldStatus === 'published' && newStatus !== 'published') {
    const { data: hist } = await svc
      .from('content_pipeline_history')
      .select('from_value')
      .eq('pipeline_id', item.id)
      .eq('event_type', 'stage_changed')
      .eq('to_value', 'published')
      .order('changed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const retreatTo = (hist?.from_value as string) || 'ready'

    const { data: updated, error } = await svc
      .from('content_pipeline')
      .update({ stage: retreatTo })
      .eq('id', item.id)
      .eq('version', item.version)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[blog-sync] Failed to retreat pipeline item', item.id, error)
      return
    }

    if (!updated) {
      console.warn('[blog-sync] CAS conflict: pipeline item', item.id, 'was modified concurrently')
      return
    }

    await svc.from('content_pipeline_history').insert({
      pipeline_id: item.id,
      event_type: 'stage_changed',
      from_value: 'published',
      to_value: retreatTo,
      changed_by: null,
    })
  }
}
