'use client'

import type { TocEntry } from './types'
import { useScrollState } from './scroll-context'
import { ptBR } from './_i18n/pt-BR'
import { en } from './_i18n/en'

type Props = { sections: TocEntry[]; locale?: string }

export function ReadingProgressBar({ sections, locale }: Props) {
  const t = locale === 'pt-BR' ? ptBR : en
  const { sectionProgress } = useScrollState()
  const h2s = sections.filter((s) => s.depth === 2)

  const totalProgress = h2s.length > 0
    ? Math.round((h2s.reduce((sum, s) => sum + (sectionProgress.get(s.slug) ?? 0), 0) / h2s.length) * 100)
    : 0

  return (
    <div className="blog-progress-bar" role="progressbar" aria-label={t.readingProgress} aria-valuenow={totalProgress} aria-valuemin={0} aria-valuemax={100}>
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
