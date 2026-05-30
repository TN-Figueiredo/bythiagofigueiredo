'use client'

import Link from 'next/link'
import type { DestId } from '@/lib/social/destinations'
import { DESTINATIONS } from '@/lib/social/destinations'
import { STATUS_COLORS, formatPostDate } from './shared/social-helpers'
import type { FeedItem } from './feed-grid'

interface FeedCardProps {
  item: FeedItem
}

export function FeedCard({ item }: FeedCardProps) {
  const dest = item.destId ? DESTINATIONS[item.destId] : null
  const isStory = item.destId === 'ig_story'

  return (
    <Link
      href={`/cms/social/${item.id}`}
      className="group relative overflow-hidden rounded-xl border border-cms-border bg-cms-surface transition-all hover:-translate-y-0.5 hover:border-cms-text/20"
    >
      {/* Media area */}
      <div className="relative h-[200px] overflow-hidden bg-cms-bg">
        {item.imageUrl ? (
          isStory ? (
            <div className="flex h-full items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt="" className="h-[200px] w-[113px] rounded-lg object-cover" />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
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
            {item.destLabel}
          </span>
        )}

        {/* Status badge */}
        <span className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status] ?? 'bg-gray-500/20 text-gray-400'}`}>
          {item.statusLabel}
        </span>
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5">
        <p className="truncate text-sm font-medium text-cms-text">{item.title}</p>
        <p className="mt-0.5 text-xs text-cms-text-muted">
          {formatPostDate(item.scheduledAt) || formatPostDate(item.publishedAt)}
        </p>
      </div>
    </Link>
  )
}
