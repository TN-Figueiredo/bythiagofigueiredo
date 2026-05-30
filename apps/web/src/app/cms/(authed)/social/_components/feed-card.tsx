'use client'

import Link from 'next/link'
import type { DestId } from '@/lib/social/destinations'
import { DESTINATIONS } from '@/lib/social/destinations'
import type { SocialPostWithPipeline } from '@/lib/social/actions'

interface FeedCardProps {
  post: SocialPostWithPipeline
  destId: DestId | null
  destLabel: string
  provider: string
  statusLabel: string
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-500/20 text-green-400',
  scheduled: 'bg-blue-500/20 text-blue-400',
  failed: 'bg-red-500/20 text-red-400',
  draft: 'bg-yellow-500/20 text-yellow-400',
  publishing: 'bg-blue-500/20 text-blue-400',
}

export function FeedCard({ post, destId, destLabel, provider: _provider, statusLabel }: FeedCardProps) {
  const dest = destId ? DESTINATIONS[destId] : null
  const imageUrl = post.content.media_urls?.[0] ?? null
  const isStory = destId === 'ig_story'
  const title = post.content.title ?? post.content.description ?? '(sem titulo)'

  return (
    <Link
      href={`/cms/social/${post.id}`}
      className="group relative overflow-hidden rounded-xl border border-cms-border bg-cms-surface transition-all hover:-translate-y-0.5 hover:border-cms-text/20"
    >
      {/* Media area */}
      <div className="relative h-[200px] overflow-hidden bg-cms-bg">
        {imageUrl ? (
          isStory ? (
            <div className="flex h-full items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="" className="h-[200px] w-[113px] rounded-lg object-cover" />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          )
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-cms-text-dim">
            Sem imagem
          </div>
        )}

        {/* Dest chip */}
        {dest && (
          <span
            className="absolute top-2 left-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm"
            style={{ backgroundColor: `${dest.tint}cc` }}
          >
            {destLabel}
          </span>
        )}

        {/* Status badge */}
        <span className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[post.status] ?? 'bg-gray-500/20 text-gray-400'}`}>
          {statusLabel}
        </span>
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5">
        <p className="truncate text-sm font-medium text-cms-text">{title}</p>
        <p className="mt-0.5 text-xs text-cms-text-muted">
          {post.scheduled_at
            ? new Date(post.scheduled_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
            : post.published_at
              ? new Date(post.published_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
              : ''}
        </p>
      </div>
    </Link>
  )
}
