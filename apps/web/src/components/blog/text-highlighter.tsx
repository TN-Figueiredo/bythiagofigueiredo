'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getHighlightStorageKey, type Highlight } from './types'

type Props = {
  slug: string
  locale?: string
  children: ReactNode
}

const MAX_HIGHLIGHTS = 20

export function TextHighlighter({ slug, locale, children }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const handleSelection = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed || !containerRef.current) {
          setTooltip(null)
          return
        }
        const text = sel.toString().trim()
        if (!text || text.length < 3 || !containerRef.current.contains(sel.anchorNode)) {
          setTooltip(null)
          return
        }
        const range = sel.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        setTooltip({
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
          text,
        })
      }, 150)
    }

    document.addEventListener('selectionchange', handleSelection)
    return () => {
      document.removeEventListener('selectionchange', handleSelection)
      clearTimeout(timer)
    }
  }, [])

  const handleHighlight = () => {
    if (!tooltip) return
    const key = getHighlightStorageKey(slug, locale)
    let highlights: Highlight[] = []
    try { highlights = JSON.parse(localStorage.getItem(key) ?? '[]') } catch { /* ignore */ }
    if (highlights.length >= MAX_HIGHLIGHTS) return

    const newHighlight: Highlight = {
      id: crypto.randomUUID(),
      text: tooltip.text,
      createdAt: new Date().toISOString(),
    }
    highlights.push(newHighlight)
    localStorage.setItem(key, JSON.stringify(highlights))
    window.dispatchEvent(new CustomEvent('highlights-updated'))
    setTooltip(null)
    window.getSelection()?.removeAllRanges()
  }

  const handleCopy = () => {
    if (!tooltip) return
    try { navigator.clipboard.writeText(tooltip.text) } catch { /* clipboard API may not be available */ }
    setTooltip(null)
    window.getSelection()?.removeAllRanges()
  }

  return (
    <div ref={containerRef} className="relative">
      {children}
      {tooltip && (
        <div
          role="tooltip"
          className="fixed z-[100] flex gap-1 bg-[--pb-paper2] border border-[--pb-line] rounded-lg shadow-lg px-2 py-1.5"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <button
            onClick={handleHighlight}
            className="text-xs font-jetbrains text-pb-accent bg-transparent border-none cursor-pointer px-2 py-0.5 hover:bg-pb-accent/10 rounded"
          >
            Destacar
          </button>
          <button
            onClick={handleCopy}
            className="text-xs font-jetbrains text-pb-muted bg-transparent border-none cursor-pointer px-2 py-0.5 hover:bg-[--pb-paper2] rounded"
          >
            Copiar
          </button>
        </div>
      )}
    </div>
  )
}
