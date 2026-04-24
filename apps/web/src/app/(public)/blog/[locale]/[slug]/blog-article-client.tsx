'use client'

import { useState, type ReactNode } from 'react'
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
}

export function BlogArticleClient({ children, sections, readingTimeMin, slug, locale, keyPoints }: Props) {
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false)
  const [mobileTocOpen, setMobileTocOpen] = useState(false)

  return (
    <>
      <ReadingProgressBar sections={sections} />
      <TimeLeftPill totalMinutes={readingTimeMin} />

      <div className="reader-pinboard reader-article">
        <TextHighlighter slug={slug} locale={locale}>
          <div className="blog-body">
            {children}
          </div>
        </TextHighlighter>
      </div>

      <AiReaderButton onClick={() => setAiDrawerOpen(true)} />
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
          aria-label="Open table of contents"
        >
          ☰
        </button>
      </div>
    </>
  )
}
