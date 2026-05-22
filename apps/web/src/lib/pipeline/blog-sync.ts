import { getSupabaseServiceClient } from '@/lib/supabase/service'

async function transitionStage(
  itemId: string,
  itemVersion: number,
  fromStage: string,
  toStage: string,
): Promise<boolean> {
  const svc = getSupabaseServiceClient()

  const { data: updated, error } = await svc
    .from('content_pipeline')
    .update({ stage: toStage })
    .eq('id', itemId)
    .eq('version', itemVersion)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[blog-sync] Failed to transition pipeline item', itemId, 'to', toStage, error)
    return false
  }

  if (!updated) {
    console.warn('[blog-sync] CAS conflict: pipeline item', itemId, 'was modified concurrently')
    return false
  }

  await svc.from('content_pipeline_history').insert({
    pipeline_id: itemId,
    event_type: 'stage_changed',
    from_value: fromStage,
    to_value: toStage,
    changed_by: null,
  })

  return true
}

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

  // Advance: scheduled
  if (newStatus === 'scheduled' && item.stage !== 'scheduled') {
    await transitionStage(item.id, item.version, item.stage, 'scheduled')
    return
  }

  // Advance: published
  if (newStatus === 'published' && item.stage !== 'published') {
    await transitionStage(item.id, item.version, item.stage, 'published')
    return
  }

  // Retreat: from published or scheduled to a previous stage
  const isRetreat =
    (oldStatus === 'published' && newStatus !== 'published') ||
    (oldStatus === 'scheduled' && newStatus !== 'scheduled' && newStatus !== 'published')

  if (isRetreat) {
    const { data: hist } = await svc
      .from('content_pipeline_history')
      .select('from_value')
      .eq('pipeline_id', item.id)
      .eq('event_type', 'stage_changed')
      .eq('to_value', oldStatus)
      .order('changed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const retreatTo = (hist?.from_value as string) || 'ready'
    await transitionStage(item.id, item.version, item.stage, retreatTo)
  }
}
