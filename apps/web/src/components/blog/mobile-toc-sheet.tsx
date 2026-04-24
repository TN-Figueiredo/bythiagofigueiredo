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

  const { activeSection } = useScrollState()

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[95]" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-[--pb-paper] rounded-t-2xl z-[96] max-h-[70vh] overflow-y-auto p-6">
        <div className="w-10 h-1 bg-[--pb-line] rounded-full mx-auto mb-4" />
        <div className="blog-sidebar-label mb-3">NESTE TEXTO</div>
        <ul className="list-none mb-6">
          {sections.map((entry) => (
            <li
              key={entry.slug}
              className={`text-sm py-2 cursor-pointer border-l-2 transition-all ${
                entry.depth === 3 ? 'pl-6' : 'pl-3'
              } ${activeSection === entry.slug ? 'text-pb-ink border-pb-accent font-medium' : 'text-pb-muted border-transparent'}`}
              onClick={() => {
                document.getElementById(entry.slug)?.scrollIntoView({ behavior: 'smooth' })
                onClose()
              }}
            >
              {entry.text}
            </li>
          ))}
        </ul>
        {keyPoints && keyPoints.length > 0 && (
          <>
            <div className="blog-sidebar-label mb-3">PONTOS-CHAVE</div>
            {keyPoints.map((point, i) => (
              <div key={i} className="flex gap-2 items-start mb-2">
                <span className="font-jetbrains text-xs font-bold text-pb-accent min-w-5">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-sm text-pb-ink">{point}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  )
}
