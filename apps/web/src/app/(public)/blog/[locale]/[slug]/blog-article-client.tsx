'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  TextHighlighter,
  ReadingProgressBar,
  TimeLeftPill,
  AiReaderButton,
  AiReaderDrawer,
  MobileTocSheet,
  type TocEntry,
} from '@/components/blog'

type Props = {
  children: ReactNode
  sections: TocEntry[]
  readingTimeMin: number
  slug: string
  locale: string
  keyPoints?: string[]
  bookmarkAd?: ReactNode
  mobileInlineAd?: ReactNode
  midContentAd?: ReactNode
}

export function BlogArticleClient({ children, sections, readingTimeMin, slug, locale, keyPoints, bookmarkAd, mobileInlineAd, midContentAd }: Props) {
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false)
  const [mobileTocOpen, setMobileTocOpen] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [adPortalTarget, setAdPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!midContentAd || !bodyRef.current) return
    const headings = bodyRef.current.querySelectorAll('h2')
    if (headings.length < 2) return
    const secondH2 = headings[1]
    if (!secondH2) return
    const container = document.createElement('div')
    container.className = 'blog-ad-slot'
    secondH2.parentNode?.insertBefore(container, secondH2)
    setAdPortalTarget(container)
    return () => { container.remove() }
  }, [midContentAd])

  return (
    <div>
      <ReadingProgressBar sections={sections} />
      <TimeLeftPill totalMinutes={readingTimeMin} />

      <div className="reader-pinboard reader-article">
        <TextHighlighter slug={slug} locale={locale}>
          <div className="blog-body" ref={bodyRef}>
            {children}
          </div>
        </TextHighlighter>
        {bookmarkAd}
        {mobileInlineAd && (
          <div className="mobile-only-ad">{mobileInlineAd}</div>
        )}
      </div>

      {adPortalTarget && midContentAd && createPortal(midContentAd, adPortalTarget)}

      <AiReaderButton onClick={() => setAiDrawerOpen(true)} hidden={aiDrawerOpen} />
      <AiReaderDrawer open={aiDrawerOpen} onClose={() => setAiDrawerOpen(false)} />
      <MobileTocSheet
        open={mobileTocOpen}
        onClose={() => setMobileTocOpen(false)}
        sections={sections}
        keyPoints={keyPoints}
      />

      <div className="blog-mobile-fab fixed bottom-28 right-7 z-[89] flex flex-col gap-2">
        <button
          onClick={() => setMobileTocOpen(true)}
          className="w-11 h-11 rounded-full bg-pb-accent flex items-center justify-center text-white shadow-lg border-none cursor-pointer"
          style={{ color: 'var(--pb-bg)' }}
          aria-label="Abrir sumario"
        >
          ☰
        </button>
      </div>
    </div>
  )
}
