'use client'

import { useEffect, useRef } from 'react'
import { EDGE_TYPES, type EdgeType } from '@/lib/playlists/types'

const EDGE_TYPE_CONFIG: Record<EdgeType, { color: string; label: string; description: string }> = {
  sequence: { color: '#818cf8', label: 'Sequence', description: 'Play in order' },
  related: { color: '#4b5563', label: 'Related', description: 'See also' },
  prerequisite: { color: '#fbbf24', label: 'Prerequisite', description: 'Read this first' },
  continuation: { color: '#34d399', label: 'Continuation', description: 'Continues from' },
}

interface EdgeTypeSelectorProps {
  x: number
  y: number
  onSelect: (type: EdgeType) => void
  onCancel: () => void
}

export function EdgeTypeSelector({ x, y, onSelect, onCancel }: EdgeTypeSelectorProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCancel()
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onCancel])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.right > window.innerWidth) el.style.left = `${window.innerWidth - rect.width - 8}px`
    if (rect.bottom > window.innerHeight) el.style.top = `${window.innerHeight - rect.height - 8}px`
  }, [x, y])

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] rounded-xl border border-white/10 bg-[#14141f] p-1 shadow-2xl shadow-black/60"
      style={{ left: x, top: y }}
    >
      <p className="px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-wider text-white/30">
        Edge type
      </p>
      {EDGE_TYPES.map(type => {
        const config = EDGE_TYPE_CONFIG[type]
        return (
          <button
            key={type}
            type="button"
            onClick={() => onSelect(type)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: config.color }}
            />
            <div>
              <p className="text-xs font-medium text-white/80">{config.label}</p>
              <p className="text-[0.6rem] text-white/30">{config.description}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
