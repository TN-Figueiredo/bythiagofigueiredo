'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { SocialPost } from '@tn-figueiredo/social'
import { SocialStatusBadge } from '@/app/cms/(authed)/_shared/social/social-status-badge'
import type { SocialStrings } from '../../_i18n/types'

interface QueueListProps {
  posts: SocialPost[]
  strings: SocialStrings
  onReorderPosts: (updates: Array<{ postId: string; scheduledAt: string }>) => Promise<{ ok: boolean }>
}

export function QueueList({ posts: initialPosts, strings: t, onReorderPosts }: QueueListProps) {
  const [posts, setPosts] = useState(initialPosts)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDragStart(idx: number) {
    setDraggedIdx(idx)
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === idx) return

    const reordered = [...posts]
    const [moved] = reordered.splice(draggedIdx, 1)
    reordered.splice(idx, 0, moved!)
    setPosts(reordered)
    setDraggedIdx(idx)
  }

  function handleDragEnd() {
    if (draggedIdx === null) return
    setDraggedIdx(null)

    // Persist new order by swapping scheduled_at times (batch, parallel)
    startTransition(async () => {
      const sortedTimes = [...posts]
        .map((p) => p.scheduled_at)
        .filter(Boolean)
        .sort()

      const updates: Array<{ postId: string; scheduledAt: string }> = []
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i]!
        const newTime = sortedTimes[i]
        if (post.scheduled_at !== newTime && newTime) {
          updates.push({ postId: post.id, scheduledAt: newTime })
        }
      }

      if (updates.length > 0) {
        await onReorderPosts(updates)
      }
    })
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg text-cms-text-muted">{t.posts.emptyQueue}</p>
        <Link
          href="/cms/social/new"
          className="mt-4 rounded-md bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover"
        >
          {t.posts.newPost}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-2" role="list" aria-label="Queue">
      {posts.map((post, idx) => (
        <div
          key={post.id}
          role="listitem"
          draggable
          onDragStart={() => handleDragStart(idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDragEnd={handleDragEnd}
          className={`flex items-center gap-3 rounded-lg border bg-cms-surface px-4 py-3 transition-colors cursor-grab active:cursor-grabbing ${
            draggedIdx === idx
              ? 'border-cms-accent/50 bg-cms-accent/5'
              : 'border-cms-border hover:border-cms-accent/30'
          } ${isPending ? 'opacity-60' : ''}`}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-500/15 text-xs font-medium text-purple-400">
            {idx + 1}
          </span>

          <div className="flex-1 min-w-0">
            <Link
              href={`/cms/social/${post.id}`}
              className="text-sm font-medium text-cms-text hover:text-cms-accent line-clamp-1"
            >
              {post.content.title ??
                post.content.description ??
                post.type}
            </Link>
            <p className="text-xs text-cms-text-dim">
              {post.scheduled_at
                ? new Date(post.scheduled_at).toLocaleDateString(
                    undefined,
                    {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    },
                  )
                : ''}
            </p>
          </div>

          <SocialStatusBadge status="scheduled" label={t.status.scheduled} />
        </div>
      ))}
    </div>
  )
}
