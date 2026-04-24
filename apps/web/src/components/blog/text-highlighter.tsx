'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

type Props = {
  slug: string
  locale?: string
  children: ReactNode
}

type Highlight = {
  id: string
  text: string
  startOffset: number
  endOffset: number
  createdAt: string
}

const MAX_HIGHLIGHTS = 20

function getStorageKey(slug: string, locale?: string) {
  return `btf-highlights:${locale ? `${locale}/` : ''}${slug}`
}

export function TextHighlighter({ slug, locale, children }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  useEffect(() => {
    const handleSelection = () => {
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
    }

    document.addEventListener('selectionchange', handleSelection)
    return () => document.removeEventListener('selectionchange', handleSelection)
  }, [])

  const handleHighlight = () => {
    if (!tooltip) return
    const key = getStorageKey(slug, locale)
    let highlights: Highlight[] = []
    try { highlights = JSON.parse(localStorage.getItem(key) ?? '[]') } catch { /* ignore */ }
    if (highlights.length >= MAX_HIGHLIGHTS) return

    const newHighlight: Highlight = {
      id: crypto.randomUUID(),
      text: tooltip.text,
      startOffset: 0,
      endOffset: tooltip.text.length,
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
    navigator.clipboard.writeText(tooltip.text)
    setTooltip(null)
    window.getSelection()?.removeAllRanges()
  }

  return (
    <div ref={containerRef} className="relative">
      {children}
      {tooltip && (
        <div
          className="fixed z-[100] flex gap-1 bg-[--pb-paper2] border border-[--pb-line] rounded-lg shadow-lg px-2 py-1.5"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <button
            onClick={handleHighlight}
            className="text-xs font-jetbrains text-pb-accent bg-transparent border-none cursor-pointer px-2 py-0.5 hover:bg-[rgba(255,130,64,0.1)] rounded"
          >
            Destacar
          </button>
          <button
            onClick={handleCopy}
            className="text-xs font-jetbrains text-pb-muted bg-transparent border-none cursor-pointer px-2 py-0.5 hover:bg-[rgba(255,255,255,0.05)] rounded"
          >
            Copiar
          </button>
        </div>
      )}
    </div>
  )
}
