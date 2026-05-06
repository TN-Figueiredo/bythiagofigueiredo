import { type ReactNode } from 'react'

export function highlightText(text: string, query: string): ReactNode {
  if (!query || !text) return text

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const splitRegex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(splitRegex)

  if (parts.length === 1) return text

  const lowerQuery = query.toLowerCase()

  return parts.map((part, i) =>
    part.toLowerCase() === lowerQuery ? (
      <mark
        key={i}
        style={{ background: '#FFE37A', color: '#1A140C', padding: '0 2px' }}
      >
        {part}
      </mark>
    ) : (
      part
    )
  )
}
