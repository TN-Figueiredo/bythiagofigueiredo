'use client'

import { useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface FilterBarProps {
  collections: Array<{ code: string; name: string }>
}

type FilterKey = 'collection' | 'lang' | 'priority'

const PRIORITY_OPTIONS = [
  { value: '5', label: 'P5' },
  { value: '4', label: 'P4' },
  { value: '3', label: 'P3' },
  { value: '2', label: 'P2' },
]

const LANG_OPTIONS = [
  { value: 'pt-br', label: 'PT' },
  { value: 'en', label: 'EN' },
  { value: 'both', label: 'PT+EN' },
]

export function PipelineFilterBar({ collections }: FilterBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null)

  const activeCollection = searchParams.get('collection')
  const activeLang = searchParams.get('lang')
  const activePriority = searchParams.get('priority')

  function setFilter(key: FilterKey, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.replace(`${pathname}?${params.toString()}`)
    setOpenFilter(null)
  }

  function renderChip(key: FilterKey, label: string, active: string | null) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpenFilter(openFilter === key ? null : key)}
          className="text-xs px-2 py-1 rounded-full border transition-colors"
          style={{
            borderColor: active ? 'var(--gem-accent)' : 'var(--gem-border)',
            backgroundColor: active ? 'rgba(99,102,241,0.1)' : 'transparent',
            color: active ? 'var(--gem-text)' : 'var(--gem-muted)',
          }}
        >
          {label}{active && `: ${active}`}
        </button>

        {openFilter === key && (
          <div
            className="absolute top-full mt-1 left-0 rounded-lg border p-1 z-50 min-w-28"
            style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}
          >
            {active && (
              <button onClick={() => setFilter(key, null)} className="w-full text-left px-2 py-1 text-xs rounded hover:bg-white/5" style={{ color: 'var(--gem-dim)' }}>
                Clear
              </button>
            )}
            {key === 'collection' && collections.map((c) => (
              <button key={c.code} onClick={() => setFilter('collection', c.code)} className="w-full text-left px-2 py-1 text-xs rounded hover:bg-white/5" style={{ color: 'var(--gem-text)' }}>
                {c.name}
              </button>
            ))}
            {key === 'lang' && LANG_OPTIONS.map((o) => (
              <button key={o.value} onClick={() => setFilter('lang', o.value)} className="w-full text-left px-2 py-1 text-xs rounded hover:bg-white/5" style={{ color: 'var(--gem-text)' }}>
                {o.label}
              </button>
            ))}
            {key === 'priority' && PRIORITY_OPTIONS.map((o) => (
              <button key={o.value} onClick={() => setFilter('priority', o.value)} className="w-full text-left px-2 py-1 text-xs rounded hover:bg-white/5" style={{ color: 'var(--gem-text)' }}>
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex gap-2 mb-3">
      {renderChip('collection', 'Collection', activeCollection)}
      {renderChip('lang', 'Language', activeLang)}
      {renderChip('priority', 'Priority', activePriority)}
    </div>
  )
}
