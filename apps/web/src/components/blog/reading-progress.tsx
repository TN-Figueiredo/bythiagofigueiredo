'use client'

import type { TocEntry } from './types'
import { useScrollState } from './scroll-context'

type Props = { sections: TocEntry[] }

export function ReadingProgressBar({ sections }: Props) {
  const { sectionProgress } = useScrollState()
  const h2s = sections.filter((s) => s.depth === 2)

  return (
    <div className="blog-progress-bar">
      {h2s.map((section) => (
        <div key={section.slug} className="blog-progress-segment" data-segment={section.slug}>
          <div
            className="blog-progress-fill"
            style={{ width: `${(sectionProgress.get(section.slug) ?? 0) * 100}%` }}
          />
        </div>
      ))}
    </div>
  )
}
