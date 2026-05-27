'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { FORMAT_COLORS } from '@/lib/pipeline/colors'
import { gemMix, GEM_CSS_VARS } from '@/lib/pipeline/gem-design'
import { STAGE_ORDER, LOCALE_TO_LANGUAGE } from '@/lib/pipeline/up-next-constants'
import type { Stage } from '@/lib/pipeline/up-next-constants'
import type { SlotCandidate, WeekSlot } from '@/lib/pipeline/up-next-types'

const STAGE_SHORT: Record<string, string> = {
  idea: 'ideia',
  outline: 'roteiro',
  draft: 'rascunho',
  roteiro: 'roteiro',
  gravacao: 'gravação',
  edicao: 'edição',
  pos_producao: 'pós',
  ready: 'pronto',
}

const LANG_FLAG: Record<string, string> = {
  'pt-br': '🇧🇷',
  en: '🇺🇸',
  both: '🌐',
}

interface WeekSlotPickerProps {
  slot: WeekSlot
  candidates: SlotCandidate[]
  onAssign: (itemId: string, slotDay: string, slotHour: string | null) => Promise<void>
  onClose: () => void
  anchorRef?: React.RefObject<HTMLElement | null>
}

export function WeekSlotPicker({ slot, candidates, onAssign, onClose, anchorRef }: WeekSlotPickerProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pos, setPos] = useState({ top: -9999, left: -9999 })
  const [ready, setReady] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const { filtered, totalFiltered } = useMemo(() => {
    const all = candidates
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
    return { filtered: all.slice(0, 15), totalFiltered: all.length }
  }, [candidates, slot.format, slot.channelLocale, query])

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
      const containerRect = containerRef.current?.getBoundingClientRect()
      const pickerWidth = (containerRect?.width && containerRect.width > 0) ? containerRect.width : 320
      const pickerHeight = (containerRect?.height && containerRect.height > 0) ? containerRect.height : 320

      let top = rect.bottom + 4
      let left = rect.left

      if (left + pickerWidth > window.innerWidth - 8) {
        left = window.innerWidth - pickerWidth - 8
      }
      if (left < 8) left = 8

      if (top + pickerHeight > window.innerHeight - 8) {
        top = rect.top - pickerHeight - 4
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
    requestAnimationFrame(() => requestAnimationFrame(reposition))
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
      setLoading(false)
    }
  }, [onAssign, onClose, slot.day, slot.hour])

  const usePortal = !!anchorRef?.current
  const dialog = (
    <div
      ref={containerRef}
      className="fixed z-50 w-80 max-w-[calc(100vw-16px)] rounded-lg border shadow-lg"
      style={{
        ...(usePortal ? GEM_CSS_VARS : {}),
        background: 'var(--gem-surface-hi)',
        borderColor: 'var(--gem-border)',
        top: pos.top,
        left: pos.left,
        visibility: usePortal && !ready ? 'hidden' : 'visible',
      } as React.CSSProperties}
      role="dialog"
      aria-modal="true"
      aria-busy={loading}
      aria-label="Escolher item para slot"
      aria-describedby="picker-context"
    >
      <p id="picker-context" className="sr-only">
        {slot.format === 'video' ? 'Video' : slot.format === 'blog_post' ? 'Blog' : 'Newsletter'} — {slot.dayLabel || slot.day}
      </p>
      {slot.channelLocale && (
        <div className="px-3 pt-2 pb-0.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--gem-muted)' }}>
          {LANG_FLAG[LOCALE_TO_LANGUAGE[slot.channelLocale] ?? ''] ?? ''} {slot.channelLocale === 'pt' ? 'Canal Português' : slot.channelLocale === 'en' ? 'English Channel' : slot.channelLocale}
        </div>
      )}
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
            } else if (e.key === 'Home') {
              e.preventDefault()
              setHighlightedIndex(0)
            } else if (e.key === 'End') {
              e.preventDefault()
              setHighlightedIndex(filtered.length - 1)
            } else if (e.key === 'Enter' && highlightedIndex >= 0 && filtered[highlightedIndex]) {
              e.preventDefault()
              handleSelect(filtered[highlightedIndex].id)
            }
          }}
          placeholder="Buscar item..."
          role="combobox"
          aria-label="Buscar item para o slot"
          aria-expanded={true}
          aria-controls="picker-listbox"
          aria-autocomplete="list"
          aria-activedescendant={highlightedIndex >= 0 && filtered[highlightedIndex] ? `picker-option-${filtered[highlightedIndex].id}` : undefined}
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

      {loading && (
        <div className="px-3 py-1.5 text-xs text-center" style={{ color: 'var(--gem-accent)' }} role="status">
          Atribuindo...
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="px-2 pb-1 text-xs rounded-md mx-2 mb-1 py-1.5"
          style={{
            color: 'var(--gem-text)',
            background: gemMix('--gem-warn', 15),
            border: `1px solid ${gemMix('--gem-warn', 25)}`,
          }}
        >
          {error}
        </div>
      )}

      <ul role="listbox" id="picker-listbox" aria-label="Itens disponíveis" className="max-h-48 overflow-y-auto" onMouseLeave={() => setHighlightedIndex(-1)}>
        {filtered.length === 0 ? (
          <li
            id="picker-option-empty"
            role="option"
            aria-disabled="true"
            aria-selected={false}
            className="px-3 py-2 text-xs text-center"
            style={{ color: 'var(--gem-dim)' }}
          >
            Nenhum item encontrado
          </li>
        ) : (
          filtered.map((item, i) => {
            const colors = FORMAT_COLORS[item.format] ?? { accent: 'var(--gem-accent)', text: 'var(--gem-muted)' }
            return (
              <li
                key={item.id}
                role="option"
                id={`picker-option-${item.id}`}
                tabIndex={-1}
                aria-selected={i === highlightedIndex}
                aria-disabled={loading}
                onMouseDown={(e) => { e.preventDefault(); if (!loading) handleSelect(item.id) }}
                onMouseEnter={() => setHighlightedIndex(i)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left motion-safe:transition-colors cursor-pointer min-h-[44px]"
                style={{
                  color: 'var(--gem-text)',
                  background: i === highlightedIndex ? gemMix('--gem-text', 8) : undefined,
                  opacity: loading ? 0.5 : undefined,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: colors.accent }}
                  aria-hidden="true"
                />
                {item.language && LANG_FLAG[item.language] && (
                  <span className="shrink-0 text-xs" aria-hidden="true">{LANG_FLAG[item.language]}</span>
                )}
                <span className="truncate flex-1">{item.title}</span>
                <span
                  className="text-[10px] px-1 rounded"
                  style={{ color: 'var(--gem-text)', background: gemMix(colors.accent, 20) }}
                  aria-hidden="true"
                >
                  {STAGE_SHORT[item.stage] ?? item.stage}
                </span>
              </li>
            )
          })
        )}
      </ul>

      {totalFiltered > 15 && (
        <p
          className="px-3 py-1.5 text-xs text-center"
          style={{ color: 'var(--gem-muted)' }}
          data-testid="picker-overflow"
        >
          Mostrando 15 de {totalFiltered} — refine a busca
        </p>
      )}
    </div>
  )

  if (usePortal) return createPortal(dialog, document.body)
  return dialog
}
