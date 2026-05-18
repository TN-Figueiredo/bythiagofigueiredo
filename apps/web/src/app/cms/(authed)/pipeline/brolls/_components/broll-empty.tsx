'use client'

interface BRollEmptyProps {
  variant: 'no-assets' | 'no-results'
  onImport?: () => void
  onClearFilters?: () => void
}

export function BRollEmpty({ variant, onImport, onClearFilters }: BRollEmptyProps) {
  if (variant === 'no-assets') {
    return (
      <div style={{ textAlign: 'center', padding: '64px 24px' }}>
        <div style={{ fontSize: 36, opacity: 0.3, marginBottom: 12 }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--gem-muted)' }}>
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" />
          </svg>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gem-text)', marginBottom: 4 }}>No B-Roll assets yet</div>
        <div style={{ fontSize: 12, color: 'var(--gem-muted)', marginBottom: 16 }}>Import your first clips to start building your B-Roll library.</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          <button onClick={onImport} style={{ fontSize: 11, fontWeight: 600, padding: '6px 14px', borderRadius: 5, background: 'var(--gem-accent)', color: 'white', border: 'none', cursor: 'pointer' }}>Import JSON</button>
        </div>
      </div>
    )
  }
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ fontSize: 12, color: 'var(--gem-muted)', marginBottom: 4 }}>No clips match your current filters</div>
      <div style={{ fontSize: 11, color: 'var(--gem-dim)', marginBottom: 8 }}>Try removing some filters or broadening your search</div>
      <button onClick={onClearFilters} style={{ fontSize: 11, color: 'var(--gem-accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}>Clear all filters</button>
    </div>
  )
}
