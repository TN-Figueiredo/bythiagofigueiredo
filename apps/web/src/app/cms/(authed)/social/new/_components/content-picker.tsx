'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { searchContent, type ContentItem } from '../_actions/search-content'

type ContentType = 'blog' | 'newsletter' | 'campaign' | 'video'
type Mode = 'cms' | 'freeform'
type TabKey = 'all' | ContentType

interface ContentPickerProps {
  onSelect: (type: ContentType, id: string, metadata: ContentItem) => void
  onModeChange: (mode: Mode) => void
  mode: Mode
}

const TAB_CONFIG: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'blog', label: 'Blog' },
  { key: 'newsletter', label: 'Newsletter' },
  { key: 'campaign', label: 'Campaign' },
  { key: 'video', label: 'Video' },
]

const TYPE_COLORS: Record<string, string> = {
  blog: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  newsletter: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  campaign: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  video: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const STATUS_DOTS: Record<string, string> = {
  published: 'bg-emerald-400',
  sent: 'bg-emerald-400',
  draft: 'bg-gray-400',
  scheduled: 'bg-blue-400',
}

const DEBOUNCE_MS = 300

export function ContentPicker({
  onSelect,
  onModeChange,
  mode,
}: ContentPickerProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<ContentItem[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({
    all: 0,
    blog: 0,
    newsletter: 0,
    campaign: 0,
    video: 0,
  })
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(
    async (q: string, type?: ContentType) => {
      setLoading(true)
      try {
        const result = await searchContent({
          query: q || undefined,
          type,
        })
        setItems(result.items)
        setCounts(result.counts)
      } catch {
        // Search errors are non-critical
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (mode === 'cms') {
      doSearch('')
    }
  }, [mode, doSearch])

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab)
    const type = tab === 'all' ? undefined : tab
    doSearch(query, type)
  }

  const handleQueryChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const type = activeTab === 'all' ? undefined : activeTab
      doSearch(value, type)
    }, DEBOUNCE_MS)
  }

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onModeChange('cms')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            mode === 'cms'
              ? 'bg-cms-accent/15 text-cms-accent'
              : 'text-cms-text-muted hover:text-cms-text'
          }`}
        >
          Do CMS
        </button>
        <button
          type="button"
          onClick={() => onModeChange('freeform')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            mode === 'freeform'
              ? 'bg-cms-accent/15 text-cms-accent'
              : 'text-cms-text-muted hover:text-cms-text'
          }`}
        >
          Compor do zero
        </button>
      </div>

      {mode === 'cms' && (
        <>
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Buscar conteudo..."
            className="w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text placeholder:text-cms-text-muted"
          />

          <div className="flex gap-1 border-b border-cms-border" role="tablist">
            {TAB_CONFIG.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeTab === key}
                aria-label={label}
                onClick={() => handleTabChange(key)}
                className={`px-3 py-1.5 text-sm font-medium ${
                  activeTab === key
                    ? 'border-b-2 border-cms-accent text-cms-accent'
                    : 'text-cms-text-muted hover:text-cms-text'
                }`}
              >
                {label}
                <span className="ml-1 text-xs text-cms-text-muted">
                  {counts[key] ?? 0}
                </span>
              </button>
            ))}
          </div>

          <div className="max-h-[320px] space-y-1 overflow-y-auto">
            {loading && items.length === 0 && (
              <p className="py-4 text-center text-sm text-cms-text-muted">
                Carregando...
              </p>
            )}

            {!loading && items.length === 0 && (
              <p className="py-4 text-center text-sm text-cms-text-muted">
                Nenhum conteudo encontrado
              </p>
            )}

            {items.map((item) => (
              <button
                key={`${item.type}-${item.id}`}
                type="button"
                onClick={() => onSelect(item.type, item.id, item)}
                className="flex w-full items-center gap-3 rounded-md border border-transparent px-3 py-2 text-left transition-colors hover:border-cms-border hover:bg-cms-surface"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-cms-border">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-cms-text-muted">
                      {item.type[0]?.toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-cms-text">
                    {item.title}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span
                      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase ${TYPE_COLORS[item.type] ?? ''}`}
                    >
                      {item.type}
                    </span>
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOTS[item.status] ?? 'bg-gray-400'}`}
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
