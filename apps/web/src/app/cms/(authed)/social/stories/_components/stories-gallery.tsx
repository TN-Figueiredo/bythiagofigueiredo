'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { StoryCard } from './story-card'
import type { ActionResult } from '@/lib/social/actions/_shared'
import type { StoryRow, StoryTab, StoryCounts } from '@/lib/social/actions/stories'

interface StoriesGalleryProps {
  siteId: string
  initialCounts: StoryCounts
  fetchStories: (siteId: string, tab: StoryTab) => Promise<ActionResult<StoryRow[]>>
}

const TABS: Array<{ id: StoryTab; label: string }> = [
  { id: 'drafts',    label: 'Rascunhos' },
  { id: 'live',      label: 'Ao Vivo' },
  { id: 'expired',   label: 'Expirados' },
  { id: 'scheduled', label: 'Agendados' },
]

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-cms-border bg-cms-surface">
      <div className="animate-pulse bg-cms-border" style={{ paddingTop: '177.78%' }} />
      <div className="space-y-2 p-3">
        <div className="h-3 w-2/3 animate-pulse rounded bg-cms-border" />
        <div className="h-2.5 w-1/2 animate-pulse rounded bg-cms-border" />
      </div>
    </div>
  )
}

function EmptyState({ tab }: { tab: StoryTab }) {
  const messages: Record<StoryTab, string> = {
    drafts:    'Nenhum rascunho por aqui.',
    live:      'Nenhuma story publicada nas últimas 24h.',
    expired:   'Nenhuma story expirada.',
    scheduled: 'Nenhuma story agendada.',
  }

  return (
    <div className="col-span-full flex flex-col items-center gap-4 py-20 text-center">
      <p className="text-sm text-cms-text-muted">{messages[tab]}</p>
      <Link
        href="/cms/social/stories/new"
        className="inline-flex items-center gap-2 rounded-md bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover"
      >
        <Plus className="h-4 w-4" />
        Nova Story
      </Link>
    </div>
  )
}

export function StoriesGallery({ siteId, initialCounts, fetchStories }: StoriesGalleryProps) {
  const [tab, setTab] = useState<StoryTab>('drafts')
  const [stories, setStories] = useState<StoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState<StoryCounts>(initialCounts)
  const pollCountRef = useRef(0)
  const [pollTimedOut, setPollTimedOut] = useState(false)

  const loadStories = useCallback(async (activeTab: StoryTab) => {
    setLoading(true)
    try {
      const result = await fetchStories(siteId, activeTab)
      if (result.ok) {
        setStories(result.data)
        setCounts((prev) => ({ ...prev, [activeTab]: result.data.length }))
      }
    } finally {
      setLoading(false)
    }
  }, [siteId, fetchStories])

  useEffect(() => {
    void loadStories(tab)
  }, [tab, loadStories])

  // Auto-refresh while stories are publishing, with a 3-minute cap (36 x 5s)
  useEffect(() => {
    const hasPublishing = stories.some((s) => s.status === 'publishing')
    if (!hasPublishing) {
      pollCountRef.current = 0
      setPollTimedOut(false)
      return
    }
    if (pollCountRef.current >= 36) {
      setPollTimedOut(true)
      return
    }
    const id = setInterval(() => {
      pollCountRef.current += 1
      if (pollCountRef.current >= 36) {
        clearInterval(id)
        setPollTimedOut(true)
        return
      }
      void loadStories(tab)
    }, 5000)
    return () => clearInterval(id)
  }, [stories, tab, loadStories])

  // Reset poll counter when the user returns to the tab
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        pollCountRef.current = 0
        setPollTimedOut(false)
        void loadStories(tab)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [tab, loadStories])

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-cms-border pb-0">
        {TABS.map(({ id, label }) => {
          const count = counts[id]
          const isActive = tab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={[
                'relative inline-flex items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-sm font-medium transition-colors',
                isActive
                  ? 'border-cms-accent text-cms-accent'
                  : 'border-transparent text-cms-text-muted hover:text-cms-text',
              ].join(' ')}
            >
              {label}
              {count > 0 && (
                <span
                  className={[
                    'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums',
                    isActive
                      ? 'bg-cms-accent text-white'
                      : 'bg-cms-border text-cms-text-muted',
                  ].join(' ')}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Polling timeout warning */}
      {pollTimedOut && (
        <div className="rounded-md border border-amber-600/40 bg-amber-950/30 px-4 py-2 text-sm text-amber-300">
          A publicacao esta demorando mais que o esperado. Recarregue a pagina ou tente novamente.
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : stories.length === 0
            ? <EmptyState tab={tab} />
            : stories.map((story) => <StoryCard key={story.id} story={story} />)}
      </div>
    </div>
  )
}
