'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { FeedCard } from './feed-card'
import type { DestId } from '@/lib/social/destinations'

export interface FeedItem {
  id: string
  status: string
  title: string
  imageUrl: string | null
  scheduledAt: string | null
  publishedAt: string | null
  destId: DestId | null
  destLabel: string
  provider: string
  statusLabel: string
}

interface FeedGridProps {
  items: FeedItem[]
}

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'published', label: 'Publicados' },
  { key: 'scheduled', label: 'Agendados' },
  { key: 'failed', label: 'Falharam' },
] as const

export function FeedGrid({ items }: FeedGridProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeFilter = searchParams.get('status') ?? 'all'

  function setFilter(key: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (key === 'all') {
      params.delete('status')
    } else {
      params.set('status', key)
    }
    router.push(`/cms/social?${params.toString()}`)
  }

  return (
    <>
      <div className="mt-4 flex gap-2" role="group" aria-label="Filtrar por status">
        {FILTERS.map(f => {
          const isActive = activeFilter === f.key
          return (
            <button
              key={f.key}
              aria-pressed={isActive}
              onClick={() => setFilter(f.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-cms-accent text-white shadow-sm shadow-cms-accent/25'
                  : 'border border-cms-border bg-transparent text-cms-text-muted hover:bg-cms-surface hover:text-cms-text'
              }`}
            >
              {f.label}
              {isActive && items.length > 0 && (
                <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-white/20 px-1 py-px text-[10px] font-semibold leading-none text-white">
                  {items.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {items.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cms-surface">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cms-text-muted">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
          </div>
          <p className="text-sm text-cms-text-muted">
            {activeFilter === 'all'
              ? 'Nenhum post encontrado'
              : `Nenhum post ${FILTERS.find(f => f.key === activeFilter)?.label.toLowerCase() ?? ''}`}
          </p>
          <p className="text-xs text-cms-text-muted/60">
            {activeFilter === 'all'
              ? 'Crie seu primeiro post para comecar'
              : 'Tente outro filtro ou crie um novo post'}
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(248px,1fr))] gap-4" role="list">
          {items.map(item => (
            <div key={item.id} role="listitem">
              <FeedCard item={item} />
            </div>
          ))}
        </div>
      )}
    </>
  )
}
