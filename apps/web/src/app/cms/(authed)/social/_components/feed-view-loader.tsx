import { listFeedPostsWithDeliveries } from '@/lib/social/actions'
import { DESTINATIONS, DEST_IDS, type DestId } from '@/lib/social/destinations'
import type { Provider } from '@tn-figueiredo/social'
import { FeedGrid } from './feed-grid'

export async function FeedViewLoader({ siteId, status }: { siteId: string; status?: string }) {
  const result = await listFeedPostsWithDeliveries(siteId, { status: status || 'all' })
  if (!result.ok) return <p className="text-sm text-cms-text-muted">Erro ao carregar posts</p>
  if (result.data.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-cms-text-muted">Nenhum post encontrado</p>
      </div>
    )
  }

  const feedItems = result.data.map(item => {
    const firstDelivery = item.deliveries[0]
    const provider = firstDelivery?.provider as Provider | undefined
    const destId = provider
      ? DEST_IDS.find(id => DESTINATIONS[id].provider === provider) ?? null
      : null
    const dest = destId ? DESTINATIONS[destId] : null
    return {
      post: item.post,
      destId,
      destLabel: dest ? `${dest.label} ${dest.sublabel}` : provider ?? '',
      provider: provider ?? '',
      deliveryCount: item.deliveries.length,
    }
  })

  return <FeedGrid items={feedItems} />
}
