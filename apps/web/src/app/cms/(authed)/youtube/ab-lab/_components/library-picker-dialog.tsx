'use client'

import { useState, useRef } from 'react'
import { X } from 'lucide-react'
import { YtPortal } from '../../_components/yt-portal'
import { useModalFocusTrap } from '@/app/cms/(authed)/_shared/editor/use-modal-focus-trap'
import { Longevity } from './longevity'

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

function longevityDotCount(checkpoints: LibraryEntry['thumbnail_longevity']): number {
  if (!checkpoints.length) return 0
  const sorted = [...checkpoints].sort((a, b) => a.checkpoint_days - b.checkpoint_days)
  let filled = 0
  for (const cp of sorted) {
    if (cp.status === 'growing' || cp.status === 'stable') {
      filled++
    } else {
      break
    }
  }
  return Math.min(4, Math.max(filled, checkpoints.length > 0 ? 1 : 0))
}

export function LibraryPickerDialog({ entries, onSelect, onClose }: LibraryPickerDialogProps) {
  const [filter, setFilter] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useModalFocusTrap(dialogRef, true, onClose)

  const allTags = [...new Set(entries.flatMap(e => e.tags))]
  const filtered = filter ? entries.filter(e => e.tags.includes(filter)) : entries
  const sorted = [...filtered].sort((a, b) => (b.lift_at_win ?? 0) - (a.lift_at_win ?? 0))

  return (
    <YtPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Escolher da Biblioteca"
          className="flex flex-col mx-4"
          style={{
            width: 'min(750px, 100%)',
            maxHeight: 'calc(100vh - 80px)',
            background: 'var(--cms-surface)',
            border: '1px solid var(--cms-border, #332D25)',
            borderRadius: 18,
            boxShadow: 'var(--shadow-pop, 0 24px 60px -20px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4))',
            overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between py-4 px-5 shrink-0"
            style={{ borderBottom: '1px solid var(--cms-border, #332D25)' }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--cms-text)', margin: 0 }}>
              Escolher da Biblioteca
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 shrink-0"
              style={{ background: 'transparent', border: 'none', color: 'var(--cms-text-dim)', cursor: 'pointer' }}
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Filters */}
          {allTags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap px-5 py-2 shrink-0" style={{ borderBottom: '1px solid var(--cms-border, #332D25)' }}>
              <button
                onClick={() => setFilter(null)}
                className={`chip${!filter ? ' on' : ''}`}
                style={{ padding: '3px 9px', fontSize: 10 }}
              >
                Todos ({entries.length})
              </button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setFilter(filter === tag ? null : tag)}
                  className={`chip${filter === tag ? ' on' : ''}`}
                  style={{ padding: '3px 9px', fontSize: 10 }}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-5" style={{ maxHeight: 'calc(80vh - 120px)' }}>
            {sorted.length === 0 ? (
              <p className="text-center py-8" style={{ fontSize: 13, color: 'var(--cms-text-dim)' }}>
                Nenhuma thumbnail na biblioteca.
              </p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 12,
                }}
              >
                {sorted.map(entry => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onSelect(entry.blob_url, entry.lift_at_win)}
                    className="picker-item text-left"
                    style={{
                      borderRadius: 12,
                      border: '1px solid var(--cms-border, #332D25)',
                      background: 'var(--cms-surface-2, #272219)',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      padding: 0,
                      transition: 'border-color var(--t-fast, 0.12s) var(--ease-out, ease-out)',
                    }}
                  >
                    <div className="relative" style={{ aspectRatio: '16/9' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={entry.blob_url}
                        alt={entry.title ?? ''}
                        className="h-full w-full object-cover"
                        style={{ display: 'block' }}
                      />
                      {entry.source_type === 'test_winner' && (
                        <span
                          className="absolute rounded font-bold text-white"
                          style={{ top: 4, left: 4, background: '#16a34a', padding: '1px 5px', fontSize: 8 }}
                        >
                          WINNER
                        </span>
                      )}
                    </div>
                    <div style={{ padding: '8px 10px' }} className="space-y-1">
                      <p className="truncate" style={{ fontSize: 10, fontWeight: 500, color: 'var(--cms-text)' }}>
                        {entry.title}
                      </p>
                      {entry.lift_at_win !== null && (
                        <span
                          className="font-mono"
                          style={{
                            fontSize: 11,
                            color: entry.lift_at_win > 0 ? '#4ade80' : '#f87171',
                          }}
                        >
                          {entry.lift_at_win > 0 ? '+' : ''}{entry.lift_at_win}% lift
                        </span>
                      )}
                      {entry.tags.length > 0 && (
                        <div className="flex gap-0.5 flex-wrap">
                          {entry.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="rounded px-1 py-0.5 text-[8px]" style={{ background: 'var(--cms-bg)', color: 'var(--cms-text-dim)' }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Longevity component */}
                      {entry.thumbnail_longevity.length > 0 && (
                        <Longevity n={longevityDotCount(entry.thumbnail_longevity)} size={5} />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-end py-3 px-5 shrink-0"
            style={{ borderTop: '1px solid var(--cms-border, #332D25)', background: 'var(--cms-bg-side, var(--cms-bg))' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </YtPortal>
  )
}
