'use client'

import { useState, useEffect } from 'react'

type Highlight = {
  id: string
  text: string
  startOffset: number
  endOffset: number
  createdAt: string
}

type Props = {
  slug: string
  locale?: string
}

function getStorageKey(slug: string, locale?: string) {
  return `btf-highlights:${locale ? `${locale}/` : ''}${slug}`
}

export function HighlightsSidebar({ slug, locale }: Props) {
  const [highlights, setHighlights] = useState<Highlight[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(getStorageKey(slug, locale))
      if (stored) setHighlights(JSON.parse(stored))
    } catch { /* ignore corrupt data */ }
  }, [slug, locale])

  useEffect(() => {
    const handleStorage = () => {
      try {
        const stored = localStorage.getItem(getStorageKey(slug, locale))
        setHighlights(stored ? JSON.parse(stored) : [])
      } catch { /* ignore */ }
    }
    window.addEventListener('highlights-updated', handleStorage)
    return () => window.removeEventListener('highlights-updated', handleStorage)
  }, [slug, locale])

  const removeHighlight = (id: string) => {
    const updated = highlights.filter((h) => h.id !== id)
    localStorage.setItem(getStorageKey(slug, locale), JSON.stringify(updated))
    setHighlights(updated)
    window.dispatchEvent(new CustomEvent('highlights-updated'))
  }

  return (
    <div className="mt-6">
      <div className="blog-sidebar-label">SEUS DESTAQUES</div>
      {highlights.length === 0 ? (
        <p className="text-xs text-pb-faint italic">Selecione texto no artigo para destacar.</p>
      ) : (
        highlights.map((h) => (
          <div
            key={h.id}
            className="font-source-serif text-[13px] italic text-pb-ink p-2 bg-[rgba(255,227,122,0.06)] border-l-2 border-[--pb-marker] rounded-r mb-1.5 leading-snug relative"
            style={{ fontFamily: 'var(--font-source-serif), Georgia, serif' }}
          >
            &ldquo;{h.text}&rdquo;
            <button
              onClick={() => removeHighlight(h.id)}
              className="absolute top-1 right-1.5 text-[10px] text-pb-faint cursor-pointer bg-transparent border-none p-0"
            >
              ×
            </button>
          </div>
        ))
      )}
    </div>
  )
}
