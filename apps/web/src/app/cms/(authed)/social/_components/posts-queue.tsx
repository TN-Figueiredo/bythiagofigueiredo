'use client'

import Link from 'next/link'
import type { SocialPost } from '@tn-figueiredo/social'
import { SocialStatusBadge } from '@/app/cms/(authed)/_shared/social/social-status-badge'
import type { SocialStrings } from '../_i18n/types'

interface PostsQueueProps {
  posts: SocialPost[]
  strings: SocialStrings
}

export function PostsQueue({ posts, strings: t }: PostsQueueProps) {
  const queued = posts.filter(p => p.status === 'scheduled').sort((a, b) =>
    new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime()
  )

  if (queued.length === 0) {
    return <p className="py-12 text-center text-cms-text-muted">{t.posts.emptyQueue}</p>
  }

  return (
    <div className="space-y-2">
      {queued.map((post, i) => (
        <Link key={post.id} href={`/cms/social/${post.id}`} className="flex items-center gap-3 rounded-lg border border-cms-border bg-cms-surface px-4 py-3 hover:border-cms-accent/30 transition-colors">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/15 text-xs font-medium text-purple-400">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-cms-text truncate">{post.content.title ?? post.content.description ?? post.type}</p>
            <p className="text-xs text-cms-text-dim">
              {post.scheduled_at ? new Date(post.scheduled_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
            </p>
          </div>
          <SocialStatusBadge status="scheduled" label={t.status.scheduled} />
        </Link>
      ))}
    </div>
  )
}

export async function QueueViewLoader({ siteId }: { siteId: string }) {
  void siteId
  return null // stub -- replaced in Task 2.6
}
