'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface ContentCiteSelectorProps {
  enabled: boolean
  onCite: (text: string) => void
  children: React.ReactNode
}

export function ContentCiteSelector({ enabled, onCite, children }: ContentCiteSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{ text: string; top: number; left: number } | null>(null)
  const hide = useCallback(() => setTooltip(null), [])

  const cite = useCallback(() => {
    if (!tooltip) return
    onCite(tooltip.text)
    window.getSelection()?.removeAllRanges()
    hide()
  }, [tooltip, onCite, hide])

  useEffect(() => {
    if (!enabled) { hide(); return }
    const onSel = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.rangeCount) { hide(); return }
      const range = sel.getRangeAt(0)
      if (!containerRef.current?.contains(range.commonAncestorContainer)) { hide(); return }
      const text = sel.toString().trim()
      if (text.length < 10) { hide(); return }
      const r = range.getBoundingClientRect()
      const tw = 96, th = 32
      setTooltip({
        text,
        top: Math.max(4, r.top - th),
        left: Math.min(window.innerWidth - tw - 4, Math.max(4, r.left + r.width / 2 - tw / 2)),
      })
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [enabled, hide])

  useEffect(() => {
    if (!tooltip) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide()
      if (e.key === 'Enter') { e.preventDefault(); cite() }
    }
    const onDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest('[data-cite-tooltip]')) return
      hide()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown) }
  }, [tooltip, hide, cite])

  const border = enabled ? '1px dashed color-mix(in srgb, var(--gem-accent) 25%, transparent)' : undefined
  const hintColor = 'color-mix(in srgb, var(--gem-accent) 50%, transparent)'

  return (
    <div ref={containerRef} data-cite-enabled={enabled || undefined} style={{ position: 'relative', border }}>
      {enabled && (
        <span style={{ position: 'absolute', top: 2, right: 4, fontSize: '8px', color: hintColor, pointerEvents: 'none' }}>
          Selecione para citar
        </span>
      )}
      {children}
      {tooltip && (
        <div data-cite-tooltip role="button" aria-label="Citar trecho selecionado" onClick={cite} style={{
          position: 'fixed', top: tooltip.top, left: tooltip.left, background: 'var(--gem-accent)',
          color: 'var(--gem-on-accent, #fff)', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer',
          zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', animation: 'citeTooltipIn .15s ease-out',
          whiteSpace: 'nowrap',
        }}>
          📌 Citar <kbd aria-hidden="true" style={{ opacity: 0.7, fontSize: '10px' }}>↵</kbd>
        </div>
      )}
    </div>
  )
}
