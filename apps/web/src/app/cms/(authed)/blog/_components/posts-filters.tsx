'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useRef, useState, useTransition } from 'react'
import type { BlogHubStrings } from '../_i18n/types'

const STATUS_KEYS = [
  { value: '', key: 'all' as const },
  { value: 'draft', key: 'draft' as const },
  { value: 'pending_review', key: 'review' as const },
  { value: 'ready', key: 'ready' as const },
  { value: 'queued', key: 'queued' as const },
  { value: 'published', key: 'published' as const },
  { value: 'archived', key: 'archived' as const },
] as const

const FALLBACK_LABELS: Record<string, string> = {
  all: 'All', draft: 'Draft', review: 'Review', ready: 'Ready',
  queued: 'Queued', published: 'Published', archived: 'Archived',
}

const STATUS_COLORS: Record<string, string> = {
  '': '', draft: 'text-cms-amber', pending_review: 'text-[var(--cms-amber,#f59e0b)]', ready: 'text-cms-accent',
  queued: 'text-cms-purple', published: 'text-cms-green', archived: 'text-cms-text-dim',
}

const LOCALE_OPTIONS = ['', 'pt-BR', 'en'] as const

interface PostsFiltersProps {
  counts: Record<string, number>
  strings?: BlogHubStrings['filters']
  allLocalesLabel?: string
}

export function PostsFilters({ counts, strings, allLocalesLabel }: PostsFiltersProps) {
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
        {STATUS_KEYS.map((tab) => {
          const isActive = currentStatus === tab.value
          const count = tab.value ? (counts[tab.value] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0)
          const label = strings?.[tab.key] ?? FALLBACK_LABELS[tab.key] ?? tab.key
          return (
            <button type="button" key={tab.value} onClick={() => updateParam('status', tab.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                ${isActive ? 'bg-cms-accent-subtle text-cms-accent' : `text-cms-text-muted hover:bg-cms-surface-hover ${STATUS_COLORS[tab.value]}`}`}>
              {label} <span className="opacity-60 ml-1">{count}</span>
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
            placeholder={strings?.searchPlaceholder ?? 'Search posts...'}
            aria-label={strings?.searchAriaLabel ?? 'Search posts'}
            className="w-full px-3 py-2 text-sm bg-cms-bg border border-cms-border rounded-[var(--cms-radius)] text-cms-text placeholder:text-cms-text-dim focus:border-cms-accent focus:outline-none" />
        </div>

        <div className="flex border border-cms-border rounded-[var(--cms-radius)] overflow-hidden">
          {LOCALE_OPTIONS.map((loc) => (
            <button type="button" key={loc} onClick={() => updateParam('locale', loc)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors
                ${currentLocale === loc ? 'bg-cms-accent-subtle text-cms-accent' : 'text-cms-text-muted hover:bg-cms-surface-hover'}`}>
              {loc || (allLocalesLabel ?? 'All')}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
