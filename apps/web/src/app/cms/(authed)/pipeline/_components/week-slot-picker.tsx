'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { FORMAT_COLORS } from '@/lib/pipeline/colors'
import { STAGE_ORDER, LOCALE_TO_LANGUAGE } from '@/lib/pipeline/up-next-constants'
import type { Stage } from '@/lib/pipeline/up-next-constants'
import type { SlotCandidate, WeekSlot } from '@/lib/pipeline/up-next-types'

interface WeekSlotPickerProps {
  slot: WeekSlot
  candidates: SlotCandidate[]
  onAssign: (itemId: string, slotDay: string, slotHour: string | null) => Promise<void>
  onClose: () => void
  anchorRef?: React.RefObject<HTMLDivElement | null>
}

export function WeekSlotPicker({ slot, candidates, onAssign, onClose, anchorRef }: WeekSlotPickerProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [ready, setReady] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const filtered = useMemo(() =>
    candidates
      .filter(item => {
        if (item.format !== slot.format) return false
        if (STAGE_ORDER[item.stage as Stage] >= STAGE_ORDER['scheduled']) return false
        if (!item.title.toLowerCase().includes(query.toLowerCase())) return false
        if (slot.channelLocale) {
          const slotLang = LOCALE_TO_LANGUAGE[slot.channelLocale] ?? slot.channelLocale
          if (item.language !== 'both' && item.language !== slotLang) return false
        }
        return true
      })
      .sort((a, b) => (STAGE_ORDER[b.stage as Stage] ?? 0) - (STAGE_ORDER[a.stage as Stage] ?? 0))
      .slice(0, 8),
    [candidates, slot.format, slot.channelLocale, query]
  )

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Escape key handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  // Click outside handler (pointerdown supports touch + mouse)
  useEffect(() => {
    const handleClickOutside = (e: PointerEvent | MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [onClose])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
          'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => el.offsetParent !== null)
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (e.shiftKey) {
        if (document.activeElement === first || !container.contains(document.activeElement)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last || !container.contains(document.activeElement)) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [])

  useEffect(() => {
    if (!anchorRef?.current) return
    let rafId = 0

    function reposition() {
      if (!anchorRef?.current) return
      const rect = anchorRef.current.getBoundingClientRect()
      const pickerWidth = 256
      const pickerMaxHeight = 280

      let top = rect.bottom + 4
      let left = rect.left

      if (left + pickerWidth > window.innerWidth - 8) {
        left = window.innerWidth - pickerWidth - 8
      }
      if (left < 8) left = 8

      if (top + pickerMaxHeight > window.innerHeight - 8) {
        top = rect.top - pickerMaxHeight - 4
        if (top < 8) top = 8
      }

      setPos({ top, left })
      setReady(true)
    }

    function handleScrollOrResize() {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(reposition)
    }

    reposition()
    window.addEventListener('scroll', handleScrollOrResize, { capture: true, passive: true })
    window.addEventListener('resize', handleScrollOrResize)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [anchorRef])

  useEffect(() => {
    return () => {
      if (errorTimerRef.current !== null) clearTimeout(errorTimerRef.current)
      if (loadingTimerRef.current !== null) clearTimeout(loadingTimerRef.current)
    }
  }, [])

  const handleSelect = useCallback(async (itemId: string) => {
    setLoading(true)
    setError(null)
    try {
      await onAssign(itemId, slot.day, slot.hour)
      onClose()
    } catch (e) {
      setError((e as Error).message || 'Erro ao atribuir')
      errorTimerRef.current = setTimeout(() => setError(null), 3000)
      setLoading(false)
    }
  }, [onAssign, onClose, slot.day, slot.hour])

  const usePortal = !!anchorRef?.current
  const dialog = (
    <div
      ref={containerRef}
      className="fixed z-50 w-64 max-w-[calc(100vw-16px)] rounded-lg border shadow-lg"
      style={{
        background: 'var(--gem-surface-hi)',
        borderColor: 'var(--gem-border)',
        top: pos.top,
        left: pos.left,
        visibility: usePortal && !ready ? 'hidden' : 'visible',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Escolher item para slot"
      aria-describedby="picker-context"
    >
      <p id="picker-context" className="sr-only">
        {slot.format === 'video' ? 'Video' : slot.format === 'blog_post' ? 'Blog' : 'Newsletter'} — {slot.dayLabel || slot.day}
      </p>
      <div className="p-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setHighlightedIndex(-1) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setHighlightedIndex(i => Math.min(i + 1, filtered.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setHighlightedIndex(i => Math.max(i - 1, 0))
            } else if (e.key === 'Enter' && highlightedIndex >= 0 && filtered[highlightedIndex]) {
              e.preventDefault()
              handleSelect(filtered[highlightedIndex].id)
            }
          }}
          placeholder="Buscar item..."
          aria-label="Buscar item para o slot"
          className="w-full rounded-md px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)]"
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
          style={{
            color: 'var(--gem-warn)',
            background: 'color-mix(in srgb, var(--gem-warn) 10%, transparent)',
          }}
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
          filtered.map((item, i) => {
            const colors = FORMAT_COLORS[item.format] ?? { accent: 'var(--gem-accent)', text: 'var(--gem-muted)' }
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleSelect(item.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left motion-safe:transition-colors hover:bg-[color-mix(in_srgb,var(--gem-text)_5%,transparent)] disabled:opacity-50 min-h-[44px]"
                  style={{
                    color: 'var(--gem-text)',
                    background: i === highlightedIndex ? 'color-mix(in srgb, var(--gem-text) 8%, transparent)' : undefined,
                  }}
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

  if (usePortal) return createPortal(dialog, document.body)
  return dialog
}
