'use client'

import Image from 'next/image'
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
      className="group relative overflow-hidden rounded-xl border border-cms-border/60 bg-cms-surface shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-cms-text/20 hover:shadow-lg hover:shadow-black/5"
    >
      {/* Media area */}
      <div className="relative h-[200px] overflow-hidden bg-cms-bg">
        {item.imageUrl ? (
          isStory ? (
            <div className="flex h-full items-center justify-center">
              <Image src={item.imageUrl} alt="" width={113} height={200} className="rounded-lg object-cover ring-1 ring-white/10" />
            </div>
          ) : (
            <Image src={item.imageUrl} alt="" fill sizes="(max-width: 768px) 100vw, 248px" className="object-cover" />
          )
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-cms-text-dim/40">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span className="text-xs">Sem imagem</span>
          </div>
        )}

        {/* Dest chip */}
        {dest && (
          <span
            className="absolute top-2 left-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white shadow-sm backdrop-blur-sm"
            style={{ backgroundColor: `${dest.tint}cc` }}
          >
            {item.destLabel}
          </span>
        )}

        {/* Status badge */}
        <span className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-medium backdrop-blur-sm ${STATUS_COLORS[item.status] ?? 'bg-gray-500/20 text-gray-400'}`}>
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
