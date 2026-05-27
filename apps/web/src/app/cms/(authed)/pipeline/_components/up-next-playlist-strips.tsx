'use client'

import { memo } from 'react'

export interface PlaylistStripItem {
  stage: string | null
  isPublished: boolean
}

export interface PlaylistStrip {
  id: string
  name: string
  items: PlaylistStripItem[]
  nextItemTitle: string | null
  nextItemStage: string | null
  nearCompletion: boolean
}

interface UpNextPlaylistStripsProps {
  playlists: PlaylistStrip[]
}

function getDotStyle(item: PlaylistStripItem): { filled: boolean; color: string } {
  if (item.isPublished) {
    return { filled: true, color: 'var(--gem-done)' }
  }
  if (item.stage != null && item.stage !== 'idea') {
    return { filled: true, color: 'var(--gem-warn)' }
  }
  return { filled: false, color: 'var(--gem-dim)' }
}

export const UpNextPlaylistStrips = memo(function UpNextPlaylistStrips({ playlists }: UpNextPlaylistStripsProps) {
  if (playlists.length === 0) return null

  return (
    <section>
      <h2
        className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: 'var(--gem-muted)' }}
      >
        Playlists em Andamento
      </h2>
      <div
        className="rounded-lg border p-3 space-y-2"
        style={{
          background: 'var(--gem-surface)',
          borderColor: 'var(--gem-border)',
        }}
      >
        {playlists.map((playlist) => (
          <div
            key={playlist.id}
            className="flex items-center gap-3 text-xs"
          >
            <span
              className="font-medium shrink-0 w-28 truncate"
              style={{ color: 'var(--gem-text)' }}
              title={playlist.name}
            >
              {playlist.name}
            </span>

            <div className="flex items-center gap-0.5" aria-hidden="true" data-testid={`dots-${playlist.id}`}>
              {playlist.items.map((item, i) => {
                const dot = getDotStyle(item)
                return (
                  <span
                    key={i}
                    className="inline-block w-2 h-2 rounded-full"
                    data-dot={dot.filled ? 'filled' : 'hollow'}
                    style={{
                      backgroundColor: dot.filled ? dot.color : 'transparent',
                      border: dot.filled ? 'none' : `1.5px solid ${dot.color}`,
                    }}
                  />
                )
              })}
            </div>
            <span className="sr-only">
              {playlist.items.filter(i => i.isPublished).length} de {playlist.items.length} publicados
            </span>

            <span
              className="shrink-0 ml-auto text-xs"
              style={{ color: 'var(--gem-muted)' }}
            >
              {playlist.nextItemTitle && playlist.nextItemStage && (
                <>
                  próximo: &quot;{playlist.nextItemTitle}&quot; [{playlist.nextItemStage}]
                </>
              )}
              {playlist.nearCompletion && (
                <span
                  className="ml-1 font-medium"
                  style={{ color: 'var(--gem-accent)' }}
                >
                  — próximo a concluir!
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
})
