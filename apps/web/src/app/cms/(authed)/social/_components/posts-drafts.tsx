'use client'

import Link from 'next/link'
import type { SocialPost } from '@tn-figueiredo/social'
import type { SocialStrings } from '../_i18n/types'

interface PostsDraftsProps {
  posts: SocialPost[]
  strings: SocialStrings
}

export function PostsDrafts({ posts, strings: t }: PostsDraftsProps) {
  const drafts = posts.filter(p => p.status === 'draft')

  if (drafts.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-cms-text-muted">{t.posts.emptyDrafts}</p>
        <Link href="/cms/social/accounts?tab=automations" className="mt-2 inline-block text-sm text-cms-accent hover:underline">
          {t.posts.emptyDraftsCta}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {drafts.map(post => (
        <div key={post.id} className="flex items-center justify-between rounded-lg border border-cms-border bg-cms-surface px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-cms-text truncate">{post.content.title ?? post.content.description ?? 'Untitled draft'}</p>
            <p className="text-xs text-cms-text-dim">{new Date(post.created_at).toLocaleDateString()}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/cms/social/new?draft=${post.id}`} className="text-sm text-cms-accent hover:underline">
              Review
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}
