'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { FORMAT_COLORS } from '@/lib/pipeline/colors'
import { STAGE_ORDER } from '@/lib/pipeline/up-next-constants'
import type { Stage } from '@/lib/pipeline/up-next-constants'
import type { PipelineItemWithSlot, WeekSlot } from '@/lib/pipeline/up-next-types'

interface WeekSlotPickerProps {
  slot: WeekSlot
  candidates: PipelineItemWithSlot[]
  onAssign: (itemId: string, slotDay: string, slotHour: string | null) => Promise<void>
  onClose: () => void
}

export function WeekSlotPicker({ slot, candidates, onAssign, onClose }: WeekSlotPickerProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = candidates
    .filter(item =>
      item.format === slot.format &&
      STAGE_ORDER[item.stage as Stage] < STAGE_ORDER['scheduled'] &&
      item.title.toLowerCase().includes(query.toLowerCase())
    )
    .sort((a, b) => (STAGE_ORDER[b.stage as Stage] ?? 0) - (STAGE_ORDER[a.stage as Stage] ?? 0))
    .slice(0, 8)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const handleSelect = useCallback(async (itemId: string) => {
    setLoading(true)
    setError(null)
    try {
      await onAssign(itemId, slot.day, slot.hour)
      onClose()
    } catch (e) {
      setError((e as Error).message || 'Erro ao atribuir')
      setTimeout(() => setError(null), 3000)
    } finally {
      setTimeout(() => setLoading(false), 1000)
    }
  }, [onAssign, onClose, slot.day, slot.hour])

  return (
    <div
      ref={containerRef}
      className="absolute z-50 mt-1 w-64 rounded-lg border shadow-lg"
      style={{
        background: 'var(--gem-surface-hi)',
        borderColor: 'var(--gem-border)',
      }}
      role="dialog"
      aria-label="Escolher item para slot"
    >
      <div className="p-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar item..."
          className="w-full rounded-md px-2 py-1.5 text-xs outline-none"
          style={{
            background: 'var(--gem-well)',
            color: 'var(--gem-text)',
            border: '1px solid var(--gem-border)',
            fontSize: '16px',
          }}
          disabled={loading}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="px-2 pb-1 text-[11px]"
          style={{ color: '#fca5a5' }}
        >
          {error}
        </div>
      )}

      <ul className="max-h-48 overflow-y-auto">
        {filtered.length === 0 ? (
          <li
            className="px-3 py-2 text-xs text-center"
            style={{ color: 'var(--gem-dim)' }}
          >
            Nenhum item encontrado
          </li>
        ) : (
          filtered.map(item => {
            const colors = FORMAT_COLORS[item.format] ?? { accent: '#6366f1', text: '#a5b4fc' }
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleSelect(item.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors hover:bg-white/5 disabled:opacity-50"
                  style={{ color: 'var(--gem-text)' }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: colors.accent }}
                  />
                  <span className="truncate flex-1">{item.title}</span>
                  <span
                    className="text-[10px] px-1 rounded"
                    style={{ color: colors.text, background: `color-mix(in srgb, ${colors.accent} 15%, transparent)` }}
                  >
                    {item.stage}
                  </span>
                </button>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
