'use client'

import { useState, useEffect } from 'react'
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface LibraryEntry {
  id: string
  blob_url: string
  title: string | null
  tags: string[]
  lift_at_win: number | null
  source_type: string
  thumbnail_longevity: Array<{
    checkpoint_days: number
    status: string
    change_percent: number | null
  }>
}

interface LibraryPickerDialogProps {
  entries: LibraryEntry[]
  onSelect: (blobUrl: string, liftAtWin: number | null) => void
  onClose: () => void
}

export function LibraryPickerDialog({ entries, onSelect, onClose }: LibraryPickerDialogProps) {
  const [filter, setFilter] = useState<string | null>(null)
  const allTags = [...new Set(entries.flatMap(e => e.tags))]
  const filtered = filter ? entries.filter(e => e.tags.includes(filter)) : entries
  const sorted = [...filtered].sort((a, b) => (b.lift_at_win ?? 0) - (a.lift_at_win ?? 0))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[80vh] rounded-2xl border border-cms-border bg-cms-bg overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cms-border px-5 py-3">
          <h2 className="text-sm font-semibold text-cms-text">Escolher da Biblioteca</h2>
          <button onClick={onClose} className="rounded p-1 text-cms-text-dim hover:text-cms-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filters */}
        {allTags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap px-5 py-2 border-b border-cms-border">
            <button onClick={() => setFilter(null)} className={`rounded-full px-2.5 py-0.5 text-[10px] ${!filter ? 'bg-cms-accent text-black' : 'bg-cms-surface text-cms-text-muted'}`}>
              Todos ({entries.length})
            </button>
            {allTags.map(tag => (
              <button key={tag} onClick={() => setFilter(tag)} className={`rounded-full px-2.5 py-0.5 text-[10px] ${filter === tag ? 'bg-cms-accent text-black' : 'bg-cms-surface text-cms-text-muted'}`}>
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        <div className="overflow-y-auto p-5" style={{ maxHeight: 'calc(80vh - 100px)' }}>
          {sorted.length === 0 ? (
            <p className="text-center py-8 text-sm text-cms-text-dim">Nenhuma thumbnail na biblioteca.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {sorted.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => onSelect(entry.blob_url, entry.lift_at_win)}
                  className="group rounded-xl border border-cms-border bg-cms-surface overflow-hidden text-left hover:border-cms-accent/50 transition-colors"
                >
                  <div className="relative aspect-video">
                    <img src={entry.blob_url} alt={entry.title ?? ''} className="h-full w-full object-cover" />
                    {entry.source_type === 'test_winner' && (
                      <span className="absolute top-1 left-1 rounded bg-green-600 px-1.5 py-0.5 text-[8px] font-bold text-white">WINNER</span>
                    )}
                  </div>
                  <div className="p-2 space-y-1">
                    <p className="text-[10px] font-medium text-cms-text truncate">{entry.title}</p>
                    {entry.lift_at_win !== null && (
                      <span className={`text-xs font-mono ${entry.lift_at_win > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {entry.lift_at_win > 0 ? '+' : ''}{entry.lift_at_win}% lift
                      </span>
                    )}
                    {entry.tags.length > 0 && (
                      <div className="flex gap-0.5 flex-wrap">
                        {entry.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="rounded bg-cms-bg px-1 py-0.5 text-[8px] text-cms-text-dim">{tag}</span>
                        ))}
                      </div>
                    )}
                    {/* Longevity dots */}
                    {entry.thumbnail_longevity.length > 0 && (
                      <div className="flex gap-1">
                        {[7, 30, 60, 90].map(days => {
                          const cp = entry.thumbnail_longevity.find(l => l.checkpoint_days === days)
                          if (!cp) return <span key={days} className="h-1.5 w-1.5 rounded-full bg-cms-surface-hover" />
                          const Icon = cp.status === 'growing' ? TrendingUp : cp.status === 'fading' ? TrendingDown : Minus
                          const color = cp.status === 'growing' ? 'text-green-400' : cp.status === 'fading' ? 'text-red-400' : 'text-cms-text-muted'
                          return <Icon key={days} className={`h-2.5 w-2.5 ${color}`} />
                        })}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
