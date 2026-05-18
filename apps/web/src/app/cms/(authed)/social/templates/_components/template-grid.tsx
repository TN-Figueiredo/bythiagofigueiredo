'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { SocialTemplate, TemplateAspectRatio } from '@/lib/social/template-schemas'
import { ASPECT_RATIOS } from '@/lib/social/template-schemas'
import { TemplateCard } from './template-card'

interface TemplateGridProps {
  templates: SocialTemplate[]
  siteId: string
}

const TAB_LABELS: Record<TemplateAspectRatio, string> = {
  '9:16': '9:16 Vertical',
  '1:1': '1:1 Square',
  '16:9': '16:9 Landscape',
}

export function TemplateGrid({ templates, siteId }: TemplateGridProps) {
  const [activeRatio, setActiveRatio] = useState<TemplateAspectRatio>('9:16')
  const filtered = templates.filter(t => t.aspect_ratio === activeRatio)

  // Grid columns adjust by aspect ratio for sensible card sizing
  const gridClass =
    activeRatio === '9:16'
      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
      : activeRatio === '1:1'
        ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'

  const newCardAspect =
    activeRatio === '9:16'
      ? 'aspect-[9/16]'
      : activeRatio === '1:1'
        ? 'aspect-square'
        : 'aspect-video'

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 border-b border-cms-border pb-2">
          {ASPECT_RATIOS.map(ratio => (
            <button
              key={ratio}
              onClick={() => setActiveRatio(ratio)}
              aria-current={activeRatio === ratio ? 'page' : undefined}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                activeRatio === ratio
                  ? 'text-cms-accent border-b-2 border-cms-accent'
                  : 'text-cms-text-muted hover:text-cms-text'
              }`}
            >
              {TAB_LABELS[ratio]}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className={`grid gap-4 ${gridClass}`}>
        {filtered.map(template => (
          <TemplateCard
            key={template.id}
            template={template}
            siteId={siteId}
          />
        ))}

        {/* "+ New Template" card */}
        <Link
          href={`/cms/social/templates/new?ratio=${activeRatio}`}
          className={`${newCardAspect} flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-cms-border bg-cms-bg text-cms-text-dim transition-colors hover:border-cms-accent/40 hover:text-cms-accent`}
        >
          <svg className="mb-2 h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-sm font-medium">New Template</span>
        </Link>
      </div>

      {filtered.length === 0 && (
        <p className="py-12 text-center text-sm text-cms-text-dim">
          No templates for {TAB_LABELS[activeRatio]}. Create one to get started.
        </p>
      )}
    </div>
  )
}
