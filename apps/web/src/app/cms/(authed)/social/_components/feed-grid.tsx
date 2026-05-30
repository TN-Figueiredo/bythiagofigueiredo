'use client'

import { FeedCard } from './feed-card'
import type { SocialPostWithPipeline } from '@/lib/social/actions'
import type { DestId } from '@/lib/social/destinations'

export interface FeedItem {
  post: SocialPostWithPipeline
  destId: DestId | null
  destLabel: string
  provider: string
  deliveryCount: number
}

interface FeedGridProps {
  items: FeedItem[]
}

const STATUS_LABELS: Record<string, string> = {
  completed: 'Publicado',
  scheduled: 'Agendado',
  failed: 'Falhou',
  draft: 'Rascunho',
  publishing: 'Publicando',
  cancelled: 'Cancelado',
}

export function FeedGrid({ items }: FeedGridProps) {
  return (
    <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(248px,1fr))] gap-4">
      {items.map(item => (
        <FeedCard
          key={item.post.id}
          post={item.post}
          destId={item.destId}
          destLabel={item.destLabel}
          provider={item.provider}
          statusLabel={STATUS_LABELS[item.post.status] ?? item.post.status}
        />
      ))}
    </div>
  )
}
