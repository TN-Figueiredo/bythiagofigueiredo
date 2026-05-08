'use client'

import { useState, useEffect } from 'react'
import { getHighlightStorageKey, type Highlight } from './types'
import { ptBR } from './_i18n/pt-BR'
import { en } from './_i18n/en'

type Props = {
  slug: string
  locale?: string
}

export function HighlightsSidebar({ slug, locale }: Props) {
  const t = locale === 'pt-BR' ? ptBR : en
  const [highlights, setHighlights] = useState<Highlight[]>([])

  useEffect(() => {
    const loadHighlights = () => {
      try {
        const stored = localStorage.getItem(getHighlightStorageKey(slug, locale))
        setHighlights(stored ? JSON.parse(stored) : [])
      } catch { /* ignore corrupt data */ }
    }

    loadHighlights()

    window.addEventListener('highlights-updated', loadHighlights)
    return () => window.removeEventListener('highlights-updated', loadHighlights)
  }, [slug, locale])

  const removeHighlight = (id: string) => {
    const updated = highlights.filter((h) => h.id !== id)
    localStorage.setItem(getHighlightStorageKey(slug, locale), JSON.stringify(updated))
    setHighlights(updated)
    window.dispatchEvent(new CustomEvent('highlights-updated'))
  }

  return (
    <div className="mt-6">
      <div className="blog-sidebar-label">{t.yourHighlights.toUpperCase()}</div>
      {highlights.length === 0 ? (
        <p className="text-xs text-pb-faint italic">{t.highlightHint}</p>
      ) : (
        highlights.map((h) => (
          <div
            key={h.id}
            className="font-source-serif text-[13px] italic text-pb-ink p-2 bg-[--pb-marker]/10 border-l-2 border-[--pb-marker] rounded-r mb-1.5 leading-snug relative"
            style={{ fontFamily: 'var(--font-source-serif), Georgia, serif' }}
          >
            &ldquo;{h.text}&rdquo;
            <button
              onClick={() => removeHighlight(h.id)}
              aria-label={t.removeHighlight}
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
