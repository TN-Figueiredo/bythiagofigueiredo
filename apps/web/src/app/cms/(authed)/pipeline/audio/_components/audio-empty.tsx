'use client'

interface AudioEmptyProps {
  variant: 'no-assets' | 'no-results'
  onImport?: () => void
  onClearFilters?: () => void
}

export function AudioEmpty({ variant, onImport, onClearFilters }: AudioEmptyProps) {
  if (variant === 'no-assets') {
    return (
      <div style={{ textAlign: 'center', padding: '64px 24px' }}>
        <div style={{ fontSize: 36, opacity: 0.3, marginBottom: 12 }}>🎵</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gem-text)', marginBottom: 4 }}>
          No audio assets yet
        </div>
        <div style={{ fontSize: 12, color: 'var(--gem-muted)', marginBottom: 16 }}>
          Import your first tracks to start building your audio library.
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          <button
            onClick={onImport}
            style={{
              fontSize: 11, fontWeight: 600, padding: '6px 14px', borderRadius: 5,
              background: 'var(--gem-accent)', color: 'white', border: 'none', cursor: 'pointer',
            }}
          >
            Import JSON
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ fontSize: 28, opacity: 0.4, marginBottom: 8 }}>🎼</div>
      <div style={{ fontSize: 12, color: 'var(--gem-muted)', marginBottom: 4 }}>
        No tracks match your current filters
      </div>
      <div style={{ fontSize: 11, color: 'var(--gem-dim)', marginBottom: 8 }}>
        Try removing some filters or broadening your search
      </div>
      <button
        onClick={onClearFilters}
        style={{
          fontSize: 11, color: 'var(--gem-accent)', background: 'none', border: 'none',
          cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2,
        }}
      >
        Clear all filters
      </button>
    </div>
  )
}
