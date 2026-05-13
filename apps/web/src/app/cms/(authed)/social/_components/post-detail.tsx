'use client'

import Link from 'next/link'
import type { SocialPost, SocialDelivery } from '@tn-figueiredo/social'
import { useSocialDeliveries, useSocialPostStatus } from '@/lib/social/realtime'
import { SocialStatusBadge } from '@/app/cms/(authed)/_shared/social/social-status-badge'
import { DeliveryCard } from './delivery-card'
import { PostTimeline } from './post-timeline'
import type { SocialStrings } from '../_i18n/types'

interface PostDetailProps {
  post: SocialPost & { deliveries: SocialDelivery[] }
  strings: SocialStrings
}

export function PostDetail({ post, strings: t }: PostDetailProps) {
  const liveDeliveries = useSocialDeliveries(post.id)
  const liveStatus = useSocialPostStatus(post.id)

  const deliveries = liveDeliveries.length > 0 ? liveDeliveries : post.deliveries
  const status = liveStatus ?? post.status
  const statusLabel = t.status[status as keyof typeof t.status] ?? status

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/cms/social" className="text-sm text-cms-accent hover:underline">{t.detail.back}</Link>
        <div className="flex items-center gap-2">
          <SocialStatusBadge status={status} label={statusLabel} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-4">
          {post.content.title && <h2 className="text-xl font-semibold text-cms-text">{post.content.title}</h2>}
          {post.content.description && <p className="text-sm text-cms-text-muted">{post.content.description}</p>}
          {post.content.url && (
            <a href={post.content.url} target="_blank" rel="noopener noreferrer" className="text-sm text-cms-accent hover:underline block">
              {post.content.url}
            </a>
          )}
          {post.content.hashtags && post.content.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {post.content.hashtags.map(tag => (
                <span key={tag} className="rounded-full bg-cms-accent/10 px-2 py-0.5 text-xs text-cms-accent">{tag}</span>
              ))}
            </div>
          )}

          <div className="pt-4">
            <PostTimeline post={post} deliveries={deliveries} strings={t} />
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-cms-text">{t.detail.deliveryStatus}</h3>
          {deliveries.map(d => (
            <DeliveryCard key={d.id} delivery={d} strings={t} />
          ))}
        </div>
      </div>
    </div>
  )
}
