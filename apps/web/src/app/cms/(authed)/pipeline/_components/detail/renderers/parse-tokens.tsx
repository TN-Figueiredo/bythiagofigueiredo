import type { ReactNode } from 'react'
import { TimestampChip, DbChip, NegHighlight } from './tokens'

interface Token {
  type: 'text' | 'timestamp' | 'db' | 'neg'
  value: string
  start: number
  end: number
}

const PATTERNS: { type: Token['type']; re: RegExp }[] = [
  { type: 'timestamp', re: /\d{2}:\d{2}(?:[-–]\d{2}:\d{2})?/g },
  { type: 'db', re: /-?\d+dB/g },
  { type: 'neg', re: /\b(NÃO|[Nn]ot)\b/g },
]

function findTokens(text: string): Token[] {
  const tokens: Token[] = []
  for (const { type, re } of PATTERNS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      tokens.push({ type, value: m[0], start: m.index, end: m.index + m[0].length })
    }
  }
  tokens.sort((a, b) => a.start - b.start)
  const merged: Token[] = []
  for (const t of tokens) {
    if (merged.length > 0 && t.start < merged[merged.length - 1]!.end) continue
    merged.push(t)
  }
  return merged
}

export function tokenizeText(text: string): ReactNode[] {
  const tokens = findTokens(text)
  if (tokens.length === 0) return [text]

  const parts: ReactNode[] = []
  let cursor = 0
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!
    if (t.start > cursor) {
      parts.push(text.slice(cursor, t.start))
    }
    switch (t.type) {
      case 'timestamp':
        parts.push(<TimestampChip key={`ts-${i}`} ts={t.value} />)
        break
      case 'db':
        parts.push(<DbChip key={`db-${i}`} value={t.value} />)
        break
      case 'neg':
        parts.push(<NegHighlight key={`neg-${i}`} text={t.value} />)
        break
    }
    cursor = t.end
  }
  if (cursor < text.length) {
    parts.push(text.slice(cursor))
  }
  return parts
}
