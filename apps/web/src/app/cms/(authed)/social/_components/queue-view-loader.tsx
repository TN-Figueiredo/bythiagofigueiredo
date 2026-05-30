import { listSocialPosts } from '@/lib/social/actions'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { SocialPostContent } from '@tn-figueiredo/social'
import { DESTINATIONS, DEST_IDS, type DestId } from '@/lib/social/destinations'
import { getPostTitle } from './shared/social-helpers'
import { QueueList } from './queue-list'

export async function QueueViewLoader({ siteId }: { siteId: string }) {
  const result = await listSocialPosts(siteId)
  if (!result.ok) return <p className="text-sm text-cms-text-muted">Erro ao carregar fila</p>

  const queuedPosts = result.data
    .filter(p => p.status === 'scheduled' || (p.status as string) === 'queued')
    .filter(p => p.queue_position != null)
    .sort((a, b) => (a.queue_position ?? 0) - (b.queue_position ?? 0))

  if (queuedPosts.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-cms-text-muted">Nenhum post na fila</p>
        <p className="text-xs text-cms-text-dim">Posts agendados com posicao aparecem aqui</p>
      </div>
    )
  }

  // Fetch deliveries for queued posts to get provider info
  const postIds = queuedPosts.map(p => p.id)
  const supabase = getSupabaseServiceClient()
  const { data: deliveries } = await supabase
    .from('social_deliveries')
    .select('post_id, provider, format')
    .in('post_id', postIds)

  // Build a map: postId → first delivery's provider
  const deliveryMap = new Map<string, { provider: string; format: string | null }>()
  for (const d of (deliveries ?? []) as Array<Record<string, unknown>>) {
    const pid = String(d.post_id)
    if (!deliveryMap.has(pid)) {
      deliveryMap.set(pid, {
        provider: String(d.provider ?? ''),
        format: (d.format as string) ?? null,
      })
    }
  }

  const items = queuedPosts.map(post => {
    const delivery = deliveryMap.get(post.id)
    const provider = delivery?.provider ?? ''

    // Resolve destination label from provider
    const destId = DEST_IDS.find(id => DESTINATIONS[id].provider === provider)
    const dest = destId ? DESTINATIONS[destId] : null

    return {
      id: post.id,
      title: getPostTitle(post.content as SocialPostContent),
      queuePosition: post.queue_position ?? 0,
      scheduledAt: post.scheduled_at,
      status: post.status,
      provider,
      surface: dest?.surface ?? '',
      destLabel: dest?.label ?? '',
    }
  })

  return <QueueList initialItems={items} />
}
