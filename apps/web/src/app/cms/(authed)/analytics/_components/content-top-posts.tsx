'use client'

import { useState, useMemo } from 'react'
import type { TopPost } from '@/lib/analytics/content-queries'

interface Props {
  posts: TopPost[]
}

type SortKey = 'views' | 'avgDepth' | 'avgTime'

export function ContentTopPosts({ posts }: Props) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('views')

  const filtered = useMemo(() => {
    let result = posts
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(p => p.title.toLowerCase().includes(q))
    }
    return [...result].sort((a, b) => b[sortBy] - a[sortBy])
  }, [posts, search, sortBy])

  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-cms-text">Top Posts</h3>
        <div className="ml-auto flex gap-2">
          <input
            type="search"
            placeholder="Search posts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded border border-cms-border bg-cms-bg px-2 py-1 text-xs text-cms-text placeholder:text-cms-text-muted"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="rounded border border-cms-border bg-cms-bg px-2 py-1 text-xs text-cms-text"
          >
            <option value="views">Sort: Views</option>
            <option value="avgDepth">Sort: Depth</option>
            <option value="avgTime">Sort: Time</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-cms-border text-left text-cms-text-muted">
              <th scope="col" className="sticky left-0 bg-cms-surface pb-2 pr-4 font-medium">Post</th>
              <th scope="col" className="pb-2 font-medium">Status</th>
              <th scope="col" className="pb-2 text-right font-medium">Views</th>
              <th scope="col" className="pb-2 text-right font-medium">Unique</th>
              <th scope="col" className="pb-2 text-right font-medium">Depth</th>
              <th scope="col" className="pb-2 text-right font-medium">Avg Time</th>
              <th scope="col" className="pb-2 text-right font-medium">Reads 100%</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((post) => (
              <tr key={post.id} className="border-b border-cms-border/50 hover:bg-cms-bg/40">
                <td className="sticky left-0 bg-cms-surface py-2 pr-4 font-medium text-cms-text">{post.title}</td>
                <td className="py-2">
                  <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-medium text-green-400">
                    {post.status}
                  </span>
                </td>
                <td className="px-2 py-2 text-right tabular-nums font-bold">{post.views.toLocaleString()}</td>
                <td className="px-2 py-2 text-right tabular-nums text-cms-text-muted">{post.uniqueViews.toLocaleString()}</td>
                <td className="px-2 py-2 text-right">{post.avgDepth}%</td>
                <td className="px-2 py-2 text-right">{Math.floor(post.avgTime / 60)}:{String(post.avgTime % 60).padStart(2, '0')}</td>
                <td className="px-2 py-2 text-right tabular-nums">{post.readsComplete}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
