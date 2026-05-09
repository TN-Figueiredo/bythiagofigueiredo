'use client'

import { useState } from 'react'
import Link from 'next/link'

interface SearchResult {
  pipeline: Array<{ id: string; code: string; title_pt: string | null; title_en: string | null; format: string; stage: string }>
  blog_posts: Array<{ id: string; title: string; slug: string; status: string }>
  newsletters: Array<{ id: string; subject: string; status: string }>
  collections: Array<{ id: string; code: string; name: string; type: string }>
}

export function SearchResults() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSearch() {
    if (query.trim().length < 2) return
    setLoading(true)
    const res = await fetch(`/api/pipeline/search?q=${encodeURIComponent(query)}`)
    const json = await res.json()
    setResults(json.data ?? null)
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search pipeline, blog posts, newsletters..."
          className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100"
        />
        <button onClick={handleSearch} disabled={loading} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-500 disabled:opacity-50">
          {loading ? '...' : 'Search'}
        </button>
      </div>

      {results && (
        <div className="space-y-6">
          {results.pipeline.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-slate-300 mb-2">Pipeline Items ({results.pipeline.length})</h3>
              <ul className="space-y-1">
                {results.pipeline.map((item) => (
                  <li key={item.id}>
                    <Link href={`/cms/pipeline/items/${item.id}`} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-800">
                      <span className="text-xs font-mono text-slate-400">{item.code}</span>
                      <span className="text-sm text-slate-200">{item.title_pt || item.title_en}</span>
                      <span className="text-xs bg-slate-700 text-slate-400 px-1 rounded ml-auto">{item.stage}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {results.blog_posts.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-slate-300 mb-2">Blog Posts ({results.blog_posts.length})</h3>
              <ul className="space-y-1">
                {results.blog_posts.map((post) => (
                  <li key={post.id}>
                    <Link href={`/cms/blog/${post.id}`} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-800">
                      <span className="text-sm text-slate-200">{post.title}</span>
                      <span className="text-xs bg-slate-700 text-slate-400 px-1 rounded ml-auto">{post.status}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {results.newsletters.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-slate-300 mb-2">Newsletters ({results.newsletters.length})</h3>
              <ul className="space-y-1">
                {results.newsletters.map((nl) => (
                  <li key={nl.id} className="px-2 py-1.5 text-sm text-slate-300">{nl.subject} ({nl.status})</li>
                ))}
              </ul>
            </section>
          )}
          {results.collections.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-slate-300 mb-2">Collections ({results.collections.length})</h3>
              <ul className="space-y-1">
                {results.collections.map((c) => (
                  <li key={c.id} className="px-2 py-1.5 text-sm text-slate-300">{c.name} ({c.type})</li>
                ))}
              </ul>
            </section>
          )}
          {!results.pipeline.length && !results.blog_posts.length && !results.newsletters.length && !results.collections.length && (
            <p className="text-slate-500 text-sm">No results found</p>
          )}
        </div>
      )}
    </div>
  )
}
