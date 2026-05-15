'use client'

import Link from 'next/link'
import type { SocialPost, Provider } from '@tn-figueiredo/social'
import { SocialStatusBadge } from '@/app/cms/(authed)/_shared/social/social-status-badge'
import type { SocialStrings } from '../_i18n/types'

interface PostCardProps {
  post: SocialPost
  strings: SocialStrings
  selected: boolean
  onSelect: (id: string) => void
  platforms?: Provider[]
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

export function PostCard({ post, strings: t, selected, onSelect, platforms }: PostCardProps) {
  const contentPreview = post.content.title ?? post.content.description ?? t.posts.noContent
  const statusLabel = t.status[post.status as keyof typeof t.status] ?? post.status
  const dateStr = post.published_at ?? post.scheduled_at ?? post.created_at

  return (
    <div className={`flex items-start gap-3 rounded-lg border bg-cms-surface p-4 transition-colors ${selected ? 'border-cms-accent/50 bg-cms-accent/5' : 'border-cms-border'}`}>
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

        <p className="text-xs text-cms-text-dim mt-1">
          {new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}
