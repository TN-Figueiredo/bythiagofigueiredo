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
    <p
      className="text-xs leading-relaxed"
      style={{ color: 'var(--gem-dim)' }}
    >
      {text}
      {linkHref && linkLabel && (
        <>
          {' '}
          <Link
            href={linkHref}
            className="underline underline-offset-2 hover:opacity-80 transition-opacity"
            style={{ color: 'var(--gem-accent)' }}
          >
            {linkLabel}
          </Link>
        </>
      )}
    </p>
  )
}
