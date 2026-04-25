'use client'

import { useEffect } from 'react'
import { useScrollState } from './scroll-context'
import type { TocEntry } from './types'

type Props = {
  open: boolean
  onClose: () => void
  sections: TocEntry[]
  keyPoints?: string[]
}

export function MobileTocSheet({ open, onClose, sections, keyPoints }: Props) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const { activeSection } = useScrollState()

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[95]" role="presentation" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-[--pb-paper] rounded-t-2xl z-[96] max-h-[70vh] overflow-y-auto p-6" role="dialog" aria-modal="true" aria-label="Sumario">
        <div className="flex justify-between items-center mb-4">
          <div className="w-10 h-1 bg-[--pb-line] rounded-full" />
          <button onClick={onClose} aria-label="Fechar sumario" className="text-pb-muted hover:text-pb-ink text-lg bg-transparent border-none cursor-pointer p-0">×</button>
        </div>
        <div className="blog-sidebar-label mb-3">Neste texto</div>
        <ul className="list-none mb-6">
          {sections.map((entry) => (
            <li
              key={entry.slug}
              role="button"
              tabIndex={0}
              style={{
                fontSize: 14,
                padding: '8px 0 8px 12px',
                cursor: 'pointer',
                borderLeft: `2px solid ${activeSection === entry.slug ? 'var(--pb-accent)' : 'transparent'}`,
                color: activeSection === entry.slug ? 'var(--pb-ink)' : 'var(--pb-muted)',
                fontWeight: activeSection === entry.slug ? 600 : 400,
                paddingLeft: entry.depth === 3 ? 24 : 12,
                transition: 'all 0.15s',
              }}
              onClick={() => {
                document.getElementById(entry.slug)?.scrollIntoView({ behavior: 'smooth' })
                onClose()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  document.getElementById(entry.slug)?.scrollIntoView({ behavior: 'smooth' })
                  onClose()
                }
              }}
            >
              {entry.text}
            </li>
          ))}
        </ul>
        {keyPoints && keyPoints.length > 0 && (
          <>
            <div className="blog-sidebar-label mb-3">Pontos-chave</div>
            {keyPoints.map((point, i) => (
              <div key={i} className="flex gap-2 items-start mb-3">
                <span className="font-jetbrains text-xs font-bold text-pb-accent min-w-5">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className="text-sm text-pb-ink"
                  style={{ fontFamily: 'var(--font-source-serif), Georgia, serif' }}
                >
                  {point}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  )
}
