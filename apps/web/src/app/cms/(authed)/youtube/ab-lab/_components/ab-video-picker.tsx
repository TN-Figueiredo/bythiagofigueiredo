'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

interface PickerVideo {
  id: string
  title: string
  thumbnailUrl: string | null
  durationSeconds: number
  channelHandle: string
  hasActiveTest: boolean
  previousLift?: number | null
  sourcePipelineId?: string | null
}

interface Props {
  videos: PickerVideo[]
  onSelect: (video: { id: string; title: string; thumbnailUrl: string | null; durationSeconds: number; sourcePipelineId?: string | null }) => void
  onClose: () => void
}

export function AbVideoPicker({ videos, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const channels = Array.from(new Set(videos.map(v => v.channelHandle)))

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const filtered = videos.filter(v => {
    if (channelFilter && v.channelHandle !== channelFilter) return false
    if (search.trim() && !v.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function isDisabled(v: PickerVideo): boolean {
    return v.durationSeconds <= 60 || v.hasActiveTest
  }

  function getBadge(v: PickerVideo): { label: string; className: string } | null {
    if (v.durationSeconds <= 60) {
      return { label: 'Short', className: 'bg-amber-900/30 text-amber-400' }
    }
    if (v.hasActiveTest) {
      return { label: 'Active Test', className: 'bg-blue-900/30 text-blue-400' }
    }
    if (v.previousLift !== null && v.previousLift !== undefined) {
      return {
        label: `Tested ${v.previousLift >= 0 ? '+' : ''}${v.previousLift.toFixed(1)}%`,
        className: v.previousLift >= 0 ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400',
      }
    }
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-cms-surface border border-cms-border rounded-[var(--cms-radius)] max-w-lg w-full max-h-[80vh] flex flex-col mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cms-border shrink-0">
          <h2 className="text-sm font-semibold text-cms-text">Select Video to A/B Test</h2>
          <button
            onClick={onClose}
            className="text-cms-text-muted hover:text-cms-text transition-colors p-1 -mr-1 rounded"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 border-b border-cms-border shrink-0 space-y-2">
          {channels.length > 1 && (
            <select
              value={channelFilter}
              onChange={e => setChannelFilter(e.target.value)}
              className="w-full rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-1.5 text-sm text-cms-text focus:outline-none focus:ring-1 focus:ring-cms-accent"
            >
              <option value="">All channels</option>
              {channels.map(ch => (
                <option key={ch} value={ch}>
                  {ch.startsWith('@') ? ch : `@${ch}`}
                </option>
              ))}
            </select>
          )}
          <input
            ref={inputRef}
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter by title…"
            className="w-full rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 py-1.5 text-sm text-cms-text placeholder:text-cms-text-dim focus:outline-none focus:ring-2 focus:ring-cms-accent"
          />
        </div>

        {/* Video list */}
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-cms-text-muted">No videos found</p>
          ) : (
            <ul>
              {filtered.map(video => {
                const disabled = isDisabled(video)
                const badge = getBadge(video)
                return (
                  <li key={video.id}>
                    <button
                      disabled={disabled}
                      onClick={() => onSelect({
                        id: video.id,
                        title: video.title,
                        thumbnailUrl: video.thumbnailUrl,
                        durationSeconds: video.durationSeconds,
                        sourcePipelineId: video.sourcePipelineId,
                      })}
                      className={[
                        'w-full flex items-center gap-3 px-4 py-3 text-left border-b border-cms-border last:border-0 transition-colors',
                        disabled
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-cms-surface-hover cursor-pointer',
                      ].join(' ')}
                    >
                      {/* Thumbnail */}
                      <div className="shrink-0 w-[60px] h-[34px] rounded overflow-hidden bg-cms-surface-hover">
                        {video.thumbnailUrl ? (
                          <Image
                            src={video.thumbnailUrl}
                            alt={video.title}
                            width={60}
                            height={34}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cms-text-dim" aria-hidden="true">
                              <rect x="2" y="3" width="20" height="14" rx="2" />
                              <path d="M8 21h8M12 17v4" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-cms-text">{video.title}</p>
                        <p className="text-xs text-cms-text-dim">{video.channelHandle.startsWith('@') ? video.channelHandle : `@${video.channelHandle}`}</p>
                      </div>

                      {/* Badge */}
                      {badge && (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
