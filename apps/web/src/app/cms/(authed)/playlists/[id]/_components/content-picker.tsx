'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { Plus, Search, Loader2, X } from 'lucide-react'
import type { PickerItem } from '../../actions'
import type { ActionResult } from '@/lib/playlists/types'

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'blog_post', label: 'Blog' },
  { key: 'newsletter', label: 'Newsletter' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'video', label: 'Video' },
] as const

type TabKey = (typeof TABS)[number]['key']

const TYPE_DOT: Record<string, string> = {
  blog_post: 'bg-indigo-500',
  newsletter: 'bg-green-500',
  pipeline: 'bg-purple-500',
  video: 'bg-red-500',
}

const TYPE_LABEL: Record<string, string> = {
  blog_post: 'Blog',
  newsletter: 'Newsletter',
  pipeline: 'Pipeline',
  video: 'Video',
}

interface ContentPickerProps {
  isOpen: boolean
  onClose: () => void
  playlistId: string
  siteId: string
  onFetchContent: (siteId: string, playlistId: string) => Promise<ActionResult<PickerItem[]>>
  onAddItem: (siteId: string, input: unknown) => Promise<ActionResult<{ id: string }>>
  onItemAdded: () => void
}

export function ContentPicker({
  isOpen,
  onClose,
  playlistId,
  siteId,
  onFetchContent,
  onAddItem,
  onItemAdded,
}: ContentPickerProps) {
  const [items, setItems] = useState<PickerItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<TabKey>('all')
  const [adding, startAdding] = useTransition()
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    setSearch('')
    setTab('all')
    setAddedIds(new Set())

    let cancelled = false
    setLoading(true)
    setError(null)

    onFetchContent(siteId, playlistId).then(result => {
      if (cancelled) return
      if (result.ok) {
        setItems(result.data)
      } else {
        setError(result.error)
      }
      setLoading(false)
    }).catch(() => {
      if (!cancelled) {
        setError('Failed to load content')
        setLoading(false)
      }
    })

    setTimeout(() => searchRef.current?.focus(), 100)

    return () => { cancelled = true }
  }, [isOpen, siteId, playlistId, onFetchContent])

  if (!isOpen) return null

  function handleAdd(item: PickerItem) {
    const input: Record<string, unknown> = { playlistId }
    if (item.type === 'blog_post') input.blogPostId = item.id
    else if (item.type === 'newsletter') input.newsletterEditionId = item.id
    else if (item.type === 'pipeline') input.pipelineId = item.id
    else if (item.type === 'video') input.videoId = item.id

    startAdding(async () => {
      try {
        const result = await onAddItem(siteId, input)
        if (result.ok) {
          setAddedIds(prev => new Set(prev).add(item.id))
          onItemAdded()
        }
      } catch {
        // swallowed — item stays available for retry
      }
    })
  }

  const filtered = items.filter(item => {
    if (addedIds.has(item.id)) return false
    if (tab !== 'all' && item.type !== tab) return false
    if (search) {
      const q = search.toLowerCase()
      return item.title.toLowerCase().includes(q) ||
        (item.category?.toLowerCase().includes(q) ?? false)
    }
    return true
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={e => { if (e.key === 'Escape') onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label="Add content"
    >
      <div className="flex w-[520px] max-h-[70vh] flex-col rounded-xl border border-white/10 bg-[#0d0d1a] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Add Content</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-white/40 hover:bg-white/5 hover:text-white/70"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search + Tabs */}
        <div className="border-b border-white/10 px-4 py-3">
          <div className="relative mb-3">
            <Search size={14} className="absolute left-2.5 top-2.5 text-white/30" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search content…"
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-8 pr-3 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex gap-1">
            {TABS.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  tab === t.key
                    ? 'bg-white/10 text-white'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-white/30" />
            </div>
          ) : error ? (
            <p className="py-8 text-center text-xs text-red-400">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-white/30">
              {items.length === 0 ? 'No content available' : 'No matches'}
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {filtered.map(item => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleAdd(item)}
                    disabled={adding}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/5 disabled:opacity-50"
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[item.type]}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white/80">{item.title}</p>
                      <p className="text-[0.65rem] text-white/30">
                        {TYPE_LABEL[item.type]}
                        {item.status ? ` · ${item.status}` : ''}
                        {item.category ? ` · ${item.category}` : ''}
                      </p>
                    </div>
                    <Plus size={14} className="shrink-0 text-white/20" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {addedIds.size > 0 && (
          <div className="border-t border-white/10 px-4 py-2.5">
            <p className="text-xs text-green-400">{addedIds.size} item{addedIds.size !== 1 ? 's' : ''} added</p>
          </div>
        )}
      </div>
    </div>
  )
}
