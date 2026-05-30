import type { CSSProperties } from 'react'

export const CARD_STYLE: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--line, rgba(255,255,255,0.08))',
  background: 'var(--surface, #161410)',
}

export const COLORS = {
  accent: 'var(--accent, #F2683C)',
  green: 'var(--green, #46B17E)',
  amber: 'var(--amber, #E0A23C)',
  cyan: 'var(--cyan, #3FA9C0)',
  red: 'var(--red, #D9614A)',
  purple: 'var(--purple, #A77CE8)',
  ink: 'var(--ink, #ECE6DA)',
  inkDim: 'var(--ink-dim, #A39C8E)',
  inkFaint: 'var(--ink-faint, #6E685D)',
  surface2: 'var(--surface-2, #1E1B16)',
  lineStrong: 'var(--line-strong, #3a3630)',
} as const

export const FONT = {
  mono: 'var(--font-mono, monospace)',
} as const
