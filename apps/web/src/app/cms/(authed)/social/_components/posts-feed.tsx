'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { SocialPost, PostStatus, Provider } from '@tn-figueiredo/social'
import { PostCard } from './post-card'
import { BulkActionsBar } from './bulk-actions-bar'
import type { SocialStrings } from '../_i18n/types'

interface PostsFeedProps {
  posts: SocialPost[]
  siteId: string
  strings: SocialStrings
  platformsByPost?: Record<string, Provider[]>
  onRetryDelivery: (deliveryId: string) => Promise<{ ok: boolean; error?: string }>
  onDeletePost: (id: string) => Promise<{ ok: boolean }>
  onRetryPostDeliveries: (id: string) => Promise<{ ok: boolean }>
}

const FILTER_STATUSES: (PostStatus | 'all')[] = ['all', 'completed', 'scheduled', 'failed', 'draft', 'cancelled']

const STATUS_TO_FILTER_KEY: Record<string, keyof SocialStrings['posts']['filters']> = {
  completed: 'published',
  scheduled: 'scheduled',
  failed: 'failed',
  draft: 'draft',
  cancelled: 'cancelled',
}

const ALL_PLATFORMS: Provider[] = ['facebook', 'instagram', 'bluesky', 'youtube']
const PLATFORM_LABELS: Record<Provider, string> = {
  facebook: 'FB',
  instagram: 'IG',
  bluesky: 'BS',
  youtube: 'YT',
}

export function PostsFeed({ posts, siteId: _siteId, strings: t, platformsByPost = {}, onRetryDelivery, onDeletePost, onRetryPostDeliveries }: PostsFeedProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<PostStatus | 'all'>('all')
  const [platformFilters, setPlatformFilters] = useState<Set<Provider>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    let result = posts
    if (filter !== 'all') result = result.filter(p => p.status === filter)
    if (platformFilters.size > 0) {
      result = result.filter(p => {
        const postPlatforms = platformsByPost[p.id] ?? []
        return Array.from(platformFilters).some(pf => postPlatforms.includes(pf))
      })
    }
    return result
  }, [posts, filter, platformFilters, platformsByPost])

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
        <span className="mx-1 h-4 w-px bg-cms-border" />
        {ALL_PLATFORMS.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setPlatformFilters(prev => {
              const next = new Set(prev)
              if (next.has(p)) next.delete(p)
              else next.add(p)
              return next
            })}
            aria-pressed={platformFilters.has(p)}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${platformFilters.has(p) ? 'bg-cms-accent/15 text-cms-accent' : 'text-cms-text-dim hover:text-cms-text'}`}
          >
            {PLATFORM_LABELS[p]}
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
            platforms={platformsByPost[post.id]}
            onRetryDelivery={onRetryDelivery}
          />
        ))}
      </div>

      {filtered.length === 0 && posts.length > 0 && (
        <p className="text-sm text-cms-text-muted text-center py-8">
          {t.posts.emptyFilter ?? 'Nenhum resultado para os filtros selecionados.'}
        </p>
      )}

      <BulkActionsBar
        selectedIds={[...selected]}
        strings={t}
        onDone={() => { setSelected(new Set()); router.refresh() }}
        onDeletePost={onDeletePost}
        onRetryPostDeliveries={onRetryPostDeliveries}
      />
    </div>
  )
}

export async function FeedViewLoader({ siteId, status }: { siteId: string; status?: string }) {
  void siteId
  void status
  return null // stub -- replaced in Task 2.3
}
