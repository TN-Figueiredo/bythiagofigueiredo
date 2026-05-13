'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { SocialPost, PostStatus } from '@tn-figueiredo/social'
import { PostCard } from './post-card'
import { BulkActionsBar } from './bulk-actions-bar'
import type { SocialStrings } from '../_i18n/types'

interface PostsFeedProps {
  posts: SocialPost[]
  siteId: string
  strings: SocialStrings
}

/** Internal filter values — 'completed' maps to 'published' label in i18n. */
const FILTER_STATUSES: (PostStatus | 'all')[] = ['all', 'completed', 'scheduled', 'failed', 'draft', 'cancelled']

/** Maps internal PostStatus to the i18n filter key. */
const STATUS_TO_FILTER_KEY: Record<string, keyof SocialStrings['posts']['filters']> = {
  completed: 'published',
  scheduled: 'scheduled',
  failed: 'failed',
  draft: 'draft',
  cancelled: 'cancelled',
}

export function PostsFeed({ posts, siteId, strings: t }: PostsFeedProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<PostStatus | 'all'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    if (filter === 'all') return posts
    return posts.filter(p => p.status === filter)
  }, [posts, filter])

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function filterLabel(status: PostStatus | 'all'): string {
    if (status === 'all') return t.posts.filters.all
    const key = STATUS_TO_FILTER_KEY[status]
    return key ? t.posts.filters[key] : status
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg text-cms-text-muted">{t.posts.emptyFeed}</p>
        <Link href="/cms/social/new" className="mt-4 rounded-md bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover">
          {t.posts.emptyFeedCta}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTER_STATUSES.map(status => (
          <button
            key={status}
            type="button"
            onClick={() => { setFilter(status); setSelected(new Set()) }}
            aria-label={`Filter: ${filterLabel(status)}`}
            aria-current={filter === status ? 'true' : undefined}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${filter === status ? 'bg-cms-accent/15 text-cms-accent' : 'text-cms-text-muted hover:text-cms-text'}`}
          >
            {filterLabel(status)}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(post => (
          <PostCard
            key={post.id}
            post={post}
            strings={t}
            selected={selected.has(post.id)}
            onSelect={toggleSelect}
          />
        ))}
      </div>

      <BulkActionsBar
        selectedIds={[...selected]}
        strings={t}
        onDone={() => { setSelected(new Set()); router.refresh() }}
      />
    </div>
  )
}
