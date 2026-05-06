'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface PostOption {
  id: string
  title: string
  slug: string
}

interface SeriesFieldsProps {
  siteId: string
  locale: string
  currentPostId: string | null
  previousPostId: string | null
  onPreviousPostChange: (id: string | null) => void
  continuesInNext: boolean
  onContinuesChange: (val: boolean) => void
  searchPostsFn: (siteId: string, locale: string, query: string, excludeId: string | null) => Promise<PostOption[]>
}

export function SeriesFields(props: SeriesFieldsProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PostOption[]>([])
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const posts = await props.searchPostsFn(props.siteId, props.locale, query, props.currentPostId)
      setResults(posts)
    }, 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, props.siteId, props.locale, props.currentPostId, props.searchPostsFn])

  const selectPost = useCallback((post: PostOption) => {
    props.onPreviousPostChange(post.id)
    setSelectedTitle(post.title)
    setQuery('')
    setResults([])
    setShowDropdown(false)
  }, [props])

  const clearSelection = useCallback(() => {
    props.onPreviousPostChange(null)
    setSelectedTitle(null)
  }, [props])

  return (
    <div className="mt-6 pt-6 border-t border-neutral-800">
      <div className="mb-4">
        <label className="font-mono text-[10px] tracking-widest uppercase text-neutral-400 font-semibold block mb-2">
          Post anterior
        </label>
        {props.previousPostId && selectedTitle ? (
          <div className="flex items-center gap-2 border border-neutral-700 rounded-lg px-3 py-2">
            <span className="text-sm text-neutral-200 flex-1">← {selectedTitle}</span>
            <button
              type="button"
              onClick={clearSelection}
              className="text-red-400/60 hover:text-red-400 text-xs"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowDropdown(true) }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              placeholder="Buscar por título..."
              className="w-full bg-transparent border border-dashed border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 outline-none focus:border-indigo-500"
            />
            {showDropdown && results.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 border border-neutral-700 rounded bg-neutral-900 max-h-40 overflow-y-auto z-10">
                {results.map(post => (
                  <button
                    key={post.id}
                    type="button"
                    onMouseDown={() => selectPost(post)}
                    className="w-full text-left px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
                  >
                    {post.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={props.continuesInNext}
          onChange={(e) => props.onContinuesChange(e.target.checked)}
          className="accent-indigo-500"
        />
        <span className="text-sm text-neutral-200">Continua na próxima parte</span>
      </label>
    </div>
  )
}
