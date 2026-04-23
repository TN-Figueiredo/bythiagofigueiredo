'use client'

import Link from 'next/link'
import { StatusBadge } from '@/components/cms/ui'
import type { StatusVariant } from '@/components/cms/ui'

interface PostRow {
  id: string
  title: string
  slug: string
  status: string
  locales: string[]
  authorName: string
  authorInitials: string
  updatedAt: string
  readingTime: number
}

interface PostsTableProps {
  posts: PostRow[]
  total: number
  page: number
  pageSize: number
  currentParams?: string
}

function preserveParams(params: string | undefined, newPage: number): string {
  const sp = new URLSearchParams(params ?? '')
  sp.set('page', String(newPage))
  return sp.toString()
}

export function PostsTable({ posts, total, page, pageSize, currentParams }: PostsTableProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-3 opacity-30">📝</div>
        <h3 className="text-sm font-semibold text-cms-text mb-1">No posts yet</h3>
        <p className="text-xs text-cms-text-muted mb-4">Write your first blog post. Save as draft, schedule, or publish now.</p>
        <Link href="/cms/blog/new" className="inline-flex px-4 py-2 bg-cms-accent text-white text-sm rounded-[var(--cms-radius)] font-medium">
          Create first post
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cms-border text-left">
              <th className="py-3 px-4 text-xs font-medium text-cms-text-dim">Title</th>
              <th className="py-3 px-4 text-xs font-medium text-cms-text-dim">Status</th>
              <th className="py-3 px-4 text-xs font-medium text-cms-text-dim">Locale</th>
              <th className="py-3 px-4 text-xs font-medium text-cms-text-dim">Author</th>
              <th className="py-3 px-4 text-xs font-medium text-cms-text-dim">Updated</th>
              <th className="py-3 px-4 text-xs font-medium text-cms-text-dim w-16"></th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className="border-b border-cms-border-subtle hover:bg-cms-surface-hover transition-colors group">
                <td className="py-3 px-4">
                  <Link href={`/cms/blog/${post.id}/edit`} className="block">
                    <div className="text-[13px] font-medium text-cms-text truncate max-w-xs">{post.title}</div>
                    <div className="text-[11px] text-cms-text-dim">/{post.slug} · {post.readingTime} min read</div>
                  </Link>
                </td>
                <td className="py-3 px-4"><StatusBadge variant={post.status as StatusVariant} /></td>
                <td className="py-3 px-4">
                  <div className="flex gap-1">
                    {post.locales.map((l) => (
                      <span key={l} className="text-[10px] px-1.5 py-0.5 rounded border border-cms-border text-cms-text-muted">{l}</span>
                    ))}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-cms-accent flex items-center justify-center text-[9px] text-white font-semibold">{post.authorInitials}</div>
                    <span className="text-xs text-cms-text-muted">{post.authorName}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-xs text-cms-text-dim">{post.updatedAt}</td>
                <td className="py-3 px-4">
                  <Link href={`/cms/blog/${post.id}/edit`} className="text-xs text-cms-accent opacity-0 group-hover:opacity-100 transition-opacity">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-2">
        {posts.map((post) => (
          <Link key={post.id} href={`/cms/blog/${post.id}/edit`}
            className="block p-3 bg-cms-surface border border-cms-border rounded-[var(--cms-radius)]">
            <div className="flex items-start justify-between gap-2">
              <div className="text-[13px] font-medium text-cms-text line-clamp-2">{post.title}</div>
              <StatusBadge variant={post.status as StatusVariant} />
            </div>
            <div className="text-[11px] text-cms-text-dim mt-1">{post.authorName} · {post.updatedAt}</div>
          </Link>
        ))}
      </div>

      {total > pageSize && (
        <div className="flex items-center justify-between mt-4 text-xs text-cms-text-muted">
          <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
          <div className="flex gap-1">
            {page > 1 && <Link href={`/cms/blog?${preserveParams(currentParams, page - 1)}`} className="px-2 py-1 border border-cms-border rounded hover:bg-cms-surface-hover">Prev</Link>}
            <Link href={`/cms/blog?${preserveParams(currentParams, page + 1)}`} className="px-2 py-1 border border-cms-border rounded hover:bg-cms-surface-hover">Next</Link>
          </div>
        </div>
      )}
    </div>
  )
}
