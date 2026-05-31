import type { CSSProperties } from 'react'

export const labelStyle: CSSProperties = {
  fontSize: '11.5px', color: 'var(--ink-dim)', marginBottom: 6,
}

export const actionBtnStyle: CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: 5, padding: '7px 0', borderRadius: 7,
  border: '1px solid var(--line-strong)', background: 'var(--surface-2)',
  color: 'var(--ink-dim)', fontSize: 11, cursor: 'pointer',
}

export const pillBar: CSSProperties = {
  display: 'inline-flex', background: 'var(--surface-2)',
  borderRadius: 9, padding: 3, gap: 2,
}

export function pillBtn(active: boolean): CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '5px 10px', borderRadius: 7,
    border: 'none', fontSize: 12, fontWeight: 600,
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? 'var(--pb-ink-on-accent, #1A140C)' : 'var(--ink-dim)',
    cursor: 'pointer', transition: '0.15s',
  }
}

export const inputBoxStyle: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--line-strong)',
  borderRadius: 8,
}

export const hintStyle: CSSProperties = {
  fontSize: 11, color: 'var(--ink-faint)',
  display: 'flex', gap: 7, alignItems: 'center',
}

export const sectionDivider: CSSProperties = {
  borderTop: '1px solid var(--line)',
  marginTop: 2, paddingTop: 16,
}

export const sectionLabel: CSSProperties = {
  fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const,
  letterSpacing: '0.08em', color: 'var(--ink-dim)', marginBottom: 12,
}
