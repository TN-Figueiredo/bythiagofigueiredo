'use client'

import type { PlaylistItemEnriched, ContentType } from '@/lib/playlists/types'

const TYPE_BADGES: Record<ContentType, string> = {
  video: 'VIDEO', blog_post: 'BLOG', newsletter: 'NEWS', pipeline: 'PIPE',
}

interface PrintViewProps {
  playlistName: string
  filterLabel: string
  items: PlaylistItemEnriched[]
  viewNumbers: Map<string, number | null>
}

export function PrintView({ playlistName, filterLabel, items, viewNumbers }: PrintViewProps) {
  const visibleItems = items
    .filter(item => viewNumbers.get(item.id) !== null)
    .sort((a, b) => (viewNumbers.get(a.id) ?? 0) - (viewNumbers.get(b.id) ?? 0))

  return (
    <div className="hidden print:block bg-white text-black p-8 text-sm">
      <div className="mb-6 border-b-2 border-black pb-3">
        <h1 className="text-2xl font-bold">{playlistName}</h1>
        {filterLabel && <p className="text-gray-500 mt-1">{filterLabel}</p>}
        <p className="text-gray-400 text-xs mt-1">{new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' })}</p>
      </div>

      <ol className="space-y-3">
        {visibleItems.map(item => {
          const num = viewNumbers.get(item.id) ?? 0
          const typeBadge = item.content_type ? TYPE_BADGES[item.content_type] : 'N/A'
          const langBadge = item.language === 'pt-br' ? 'PT' : item.language === 'en' ? 'EN' : null

          return (
            <li key={item.id} className="flex items-start gap-3">
              <span className="w-8 text-right font-bold text-gray-400">#{num}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="rounded bg-gray-100 px-1 py-0.5 font-bold">{typeBadge}</span>
                  {langBadge && <span className="rounded bg-gray-100 px-1 py-0.5">{langBadge}</span>}
                  <span>● {item.status ?? 'unknown'}</span>
                </div>
                <p className="mt-0.5 font-medium">{item.title}</p>
                {item.metadata && <p className="text-xs text-gray-400">{item.metadata}</p>}
              </div>
            </li>
          )
        })}
      </ol>

      <div className="mt-8 border-t border-gray-200 pt-3 text-xs text-gray-400">
        {visibleItems.length} items · Generated from CMS Playlist Editor
      </div>
    </div>
  )
}
