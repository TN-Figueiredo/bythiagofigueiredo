'use client'

import { memo } from 'react'
import Link from 'next/link'
import { gemMix } from '@/lib/pipeline/gem-design'

interface UpNextSuggestionProps {
  text: string
  linkHref: string | null
  linkLabel: string | null
}

export const UpNextSuggestion = memo(function UpNextSuggestion({ text, linkHref, linkLabel }: UpNextSuggestionProps) {
  if (text === '') return null

  return (
    <aside
      role="note"
      className="rounded-lg px-4 py-3"
      style={{
        background: gemMix('--gem-accent', 4),
        border: '1px solid var(--gem-border)',
      }}
      data-testid="suggestion-container"
    >
      <p
        className="text-xs leading-relaxed"
        style={{ color: 'var(--gem-muted)' }}
      >
        {text}
        {linkHref && linkLabel && (
          <>
            {' '}
            <Link
              href={linkHref}
              className="inline-flex items-center underline underline-offset-2 hover:opacity-80 motion-safe:transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
              style={{ color: 'var(--gem-accent)' }}
              aria-label={`Ver: ${text}`}
            >
              {linkLabel}
            </Link>
          </>
        )}
      </p>
    </aside>
  )
})
