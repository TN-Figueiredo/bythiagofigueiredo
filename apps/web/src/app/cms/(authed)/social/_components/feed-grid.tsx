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
        {FILTERS.map(f => (
          <button
            key={f.key}
            aria-pressed={activeFilter === f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeFilter === f.key
                ? 'bg-cms-accent text-white'
                : 'bg-cms-surface text-cms-text-muted hover:text-cms-text'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-cms-text-muted">
            {activeFilter === 'all'
              ? 'Nenhum post encontrado'
              : `Nenhum post ${FILTERS.find(f => f.key === activeFilter)?.label.toLowerCase() ?? ''}`}
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
