'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { SocialPost, Provider } from '@tn-figueiredo/social'
import { SocialStatusBadge } from '@/app/cms/(authed)/_shared/social/social-status-badge'
import { PostMetricsInline } from './post-metrics-inline'
import type { SocialStrings } from '../_i18n/types'

interface PostCardProps {
  post: SocialPost
  strings: SocialStrings
  selected: boolean
  onSelect: (id: string) => void
  platforms?: Provider[]
  failedDeliveryIds?: string[]
  metricsLine?: string | null
  metrics?: {
    likes: number
    comments: number
    shares: number
    linkClicks: number | null
  } | null
  onRetryDelivery: (deliveryId: string) => Promise<{ ok: boolean; error?: string }>
}

const PLATFORM_COLORS: Record<Provider, string> = {
  facebook: 'bg-blue-500/15 text-blue-400',
  instagram: 'bg-pink-500/15 text-pink-400',
  bluesky: 'bg-sky-500/15 text-sky-400',
  youtube: 'bg-red-500/15 text-red-400',
}

const PLATFORM_SHORT: Record<Provider, string> = {
  facebook: 'FB',
  instagram: 'IG',
  bluesky: 'BS',
  youtube: 'YT',
}

export function PostCard({
  post,
  strings: t,
  selected,
  onSelect,
  platforms,
  failedDeliveryIds,
  metricsLine,
  metrics,
  onRetryDelivery,
}: PostCardProps) {
  const [isPending, startTransition] = useTransition()
  const [retryError, setRetryError] = useState<string | null>(null)

  const contentPreview = post.content.title ?? post.content.description ?? t.posts.noContent
  const statusLabel = t.status[post.status as keyof typeof t.status] ?? post.status
  const dateStr = post.published_at ?? post.scheduled_at ?? post.created_at
  const isFailed = post.status === 'failed' || post.status === 'partial_failure'

  function handleRetryAll() {
    if (!failedDeliveryIds || failedDeliveryIds.length === 0) return
    setRetryError(null)
    startTransition(async () => {
      for (const deliveryId of failedDeliveryIds) {
        const result = await onRetryDelivery(deliveryId)
        if (!result.ok) {
          setRetryError(result.error ?? t.common.error)
          return
        }
      }
    })
  }

  return (
    <div className={`flex items-start gap-3 rounded-lg border bg-cms-surface p-4 transition-colors ${
      selected ? 'border-cms-accent/50 bg-cms-accent/5' : isFailed ? 'border-red-500/30' : 'border-cms-border'
    }`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onSelect(post.id)}
        aria-label={`Select post: ${contentPreview}`}
        className="mt-1 accent-cms-accent"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <SocialStatusBadge status={post.status} label={statusLabel} />
          <span className="text-xs text-cms-text-dim">{post.type}</span>
          {platforms && platforms.length > 0 && (
            <div className="flex gap-1">
              {platforms.map(p => (
                <span key={p} className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${PLATFORM_COLORS[p]}`}>
                  {PLATFORM_SHORT[p]}
                </span>
              ))}
            </div>
          )}
        </div>

        <Link href={`/cms/social/${post.id}`} className="text-sm font-medium text-cms-text hover:text-cms-accent line-clamp-2">
          {contentPreview}
        </Link>

        {post.content.url && (
          <p className="text-xs text-cms-text-muted mt-0.5 truncate">{post.content.url}</p>
        )}

        {metrics ? (
          <PostMetricsInline
            likes={metrics.likes}
            comments={metrics.comments}
            shares={metrics.shares}
            linkClicks={metrics.linkClicks}
          />
        ) : metricsLine ? (
          <p className="text-xs text-cms-text-dim mt-0.5">{metricsLine}</p>
        ) : null}

        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-cms-text-dim">
            {new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>

          {isFailed && failedDeliveryIds && failedDeliveryIds.length > 0 && (
            <button
              type="button"
              onClick={handleRetryAll}
              disabled={isPending}
              className="text-xs text-cms-accent hover:underline disabled:opacity-50"
            >
              {t.posts.card.retry}
            </button>
          )}
        </div>

        {retryError && (
          <p role="alert" className="text-xs text-red-400 mt-1">
            {retryError}
          </p>
        )}
      </div>
    </div>
  )
}
