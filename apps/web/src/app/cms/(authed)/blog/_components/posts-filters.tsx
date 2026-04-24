'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useRef, useState, useTransition } from 'react'

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Review' },
  { value: 'ready', label: 'Ready' },
  { value: 'queued', label: 'Queued' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
] as const

const STATUS_COLORS: Record<string, string> = {
  '': '', draft: 'text-cms-amber', pending_review: 'text-[var(--cms-amber,#f59e0b)]', ready: 'text-cms-accent',
  queued: 'text-cms-purple', published: 'text-cms-green', archived: 'text-cms-text-dim',
}

const LOCALE_OPTIONS = ['', 'pt-BR', 'en'] as const

interface PostsFiltersProps {
  counts: Record<string, number>
}

export function PostsFilters({ counts }: PostsFiltersProps) {
  const router = useRouter()
  const params = useSearchParams()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const debounceRef = useRef<NodeJS.Timeout>(null)

  const currentStatus = params.get('status') ?? ''
  const currentLocale = params.get('locale') ?? ''

  const updateParam = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    startTransition(() => router.push(`/cms/blog?${next.toString()}`))
  }, [params, router, startTransition])

  return (
    <div className="space-y-3">
      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.map((tab) => {
          const isActive = currentStatus === tab.value
          const count = tab.value ? (counts[tab.value] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0)
          return (
            <button type="button" key={tab.value} onClick={() => updateParam('status', tab.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                ${isActive ? 'bg-cms-accent-subtle text-cms-accent' : `text-cms-text-muted hover:bg-cms-surface-hover ${STATUS_COLORS[tab.value]}`}`}>
              {tab.label} <span className="opacity-60 ml-1">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <input type="search" value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              if (debounceRef.current) clearTimeout(debounceRef.current)
              debounceRef.current = setTimeout(() => updateParam('q', e.target.value), 300)
            }}
            placeholder="Search posts..."
            aria-label="Search posts"
            className="w-full px-3 py-2 text-sm bg-cms-bg border border-cms-border rounded-[var(--cms-radius)] text-cms-text placeholder:text-cms-text-dim focus:border-cms-accent focus:outline-none" />
        </div>

        <div className="flex border border-cms-border rounded-[var(--cms-radius)] overflow-hidden">
          {LOCALE_OPTIONS.map((loc) => (
            <button type="button" key={loc} onClick={() => updateParam('locale', loc)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors
                ${currentLocale === loc ? 'bg-cms-accent-subtle text-cms-accent' : 'text-cms-text-muted hover:bg-cms-surface-hover'}`}>
              {loc || 'All'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
