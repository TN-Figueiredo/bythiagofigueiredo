import { type ReactNode } from 'react'

export function highlightText(text: string, query: string): ReactNode {
  if (!query || !text) return text

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)

  if (parts.length === 1) return text

  return parts.map((part, i) =>
    regex.test(part) ? (
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
