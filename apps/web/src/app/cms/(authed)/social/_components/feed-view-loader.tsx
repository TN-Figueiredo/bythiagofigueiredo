import { listFeedPostsWithDeliveries } from '@/lib/social/actions'
import { DESTINATIONS, DEST_IDS } from '@/lib/social/destinations'
import type { Provider } from '@tn-figueiredo/social'
import { FeedGrid } from './feed-grid'
import { STATUS_LABELS, getPostTitle } from './shared/social-helpers'

export async function FeedViewLoader({ siteId, status }: { siteId: string; status?: string }) {
  const result = await listFeedPostsWithDeliveries(siteId, { status: status || 'all' })
  if (!result.ok) return <p className="text-sm text-cms-text-muted">Erro ao carregar posts</p>

  const feedItems = result.data.map(item => {
    const firstDelivery = item.deliveries[0]
    const provider = firstDelivery?.provider as Provider | undefined
    const destId = provider
      ? DEST_IDS.find(id => DESTINATIONS[id].provider === provider) ?? null
      : null
    const dest = destId ? DESTINATIONS[destId] : null
    // Source info lives on DB columns not yet in the parsed type — cast raw row
    const rawContent = item.post.content as Record<string, unknown>
    return {
      id: item.post.id,
      status: item.post.status,
      title: getPostTitle(item.post.content),
      imageUrl: item.post.content.media_urls?.[0] ?? null,
      scheduledAt: item.post.scheduled_at,
      publishedAt: item.post.published_at,
      destId,
      destLabel: dest ? `${dest.label} ${dest.sublabel}` : provider ?? '',
      provider: provider ?? '',
      statusLabel: STATUS_LABELS[item.post.status] ?? item.post.status,
      source: (rawContent.source_title as string) ?? undefined,
      sourceType: (rawContent.source_content_type as string) ?? undefined,
      lang: 'PT' as const,
      metrics: item.metrics
        ? {
            views: item.metrics.views,
            likes: item.metrics.likes,
            comments: item.metrics.comments,
            shares: item.metrics.shares,
            engagement: item.metrics.engagement,
          }
        : undefined,
      metricsUpdatedAt: item.metrics?.updatedAt ?? undefined,
    }
  })

  return <FeedGrid items={feedItems} />
}
