'use client'

import Link from 'next/link'

interface UpNextSuggestionProps {
  text: string
  linkHref: string | null
  linkLabel: string | null
}

export function UpNextSuggestion({ text, linkHref, linkLabel }: UpNextSuggestionProps) {
  if (text === '') return null

  return (
    <div
      className="rounded-lg px-4 py-3"
      style={{
        background: 'color-mix(in srgb, var(--gem-accent) 4%, transparent)',
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
              className="inline-flex items-center min-h-[44px] underline underline-offset-2 hover:opacity-80 transition-opacity focus-visible:ring-2 focus-visible:ring-[#6366f1] focus-visible:outline-none"
              style={{ color: 'var(--gem-accent)' }}
            >
              {linkLabel}
            </Link>
          </>
        )}
      </p>
    </div>
  )
}
