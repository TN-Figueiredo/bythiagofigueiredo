'use client'

import { useState, useRef, useEffect } from 'react'
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
  const containerRef = useRef<HTMLDivElement>(null)

  const activeCollection = searchParams.get('collection')
  const activeLang = searchParams.get('lang')
  const activePriority = searchParams.get('priority')

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenFilter(null)
      }
    }
    if (openFilter) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openFilter])

  function setFilter(key: FilterKey, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.replace(`${pathname}?${params.toString()}`)
    setOpenFilter(null)
  }

  function getOptions(key: FilterKey) {
    if (key === 'collection') return collections.map((c) => ({ value: c.code, label: c.name }))
    if (key === 'lang') return LANG_OPTIONS
    return PRIORITY_OPTIONS
  }

  function renderChip(key: FilterKey, label: string, active: string | null) {
    const isOpen = openFilter === key
    const options = getOptions(key)

    return (
      <div className="relative" key={key}>
        <button
          onClick={() => setOpenFilter(isOpen ? null : key)}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className="text-xs px-2.5 py-1 rounded-full border transition-colors"
          style={{
            borderColor: active ? 'var(--gem-accent)' : 'var(--gem-border)',
            backgroundColor: active ? 'rgba(99,102,241,0.1)' : 'transparent',
            color: active ? 'var(--gem-text)' : 'var(--gem-muted)',
          }}
        >
          {label}{active && `: ${active}`}
        </button>

        {isOpen && (
          <div
            role="listbox"
            aria-label={`Filter by ${label}`}
            className="absolute top-full mt-1 left-0 rounded-lg border p-1 z-50 min-w-32 shadow-lg"
            style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
          >
            {active && (
              <button
                role="option"
                aria-selected={false}
                onClick={() => setFilter(key, null)}
                className="w-full text-left px-2.5 py-1.5 text-xs rounded hover:bg-white/5 transition-colors"
                style={{ color: 'var(--gem-dim)' }}
              >
                Clear
              </button>
            )}
            {options.map((o) => (
              <button
                key={o.value}
                role="option"
                aria-selected={active === o.value}
                onClick={() => setFilter(key, o.value)}
                className="w-full text-left px-2.5 py-1.5 text-xs rounded hover:bg-white/5 transition-colors"
                style={{
                  color: active === o.value ? 'var(--gem-accent)' : 'var(--gem-text)',
                  fontWeight: active === o.value ? 600 : 400,
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  const hasFilters = activeCollection || activeLang || activePriority

  return (
    <div ref={containerRef} className="flex items-center gap-2 mb-3">
      {renderChip('collection', 'Collection', activeCollection)}
      {renderChip('lang', 'Language', activeLang)}
      {renderChip('priority', 'Priority', activePriority)}
      {hasFilters && (
        <button
          onClick={() => {
            const params = new URLSearchParams()
            router.replace(`${pathname}?${params.toString()}`)
          }}
          className="text-[10px] px-2 py-0.5 rounded hover:bg-white/5 transition-colors"
          style={{ color: 'var(--gem-dim)' }}
        >
          Clear all
        </button>
      )}
    </div>
  )
}
