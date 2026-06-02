export default function CompetitorsLoading() {
  return (
    <div style={{ maxWidth: 1340, margin: '0 auto' }}>
      {/* page-head skeleton */}
      <div style={{ marginBottom: 20 }}>
        <div className="animate-pulse rounded" style={{ height: 22, width: 260, background: 'var(--surface-2)' }} />
        <div className="animate-pulse rounded" style={{ height: 13, width: 400, background: 'var(--surface-2)', marginTop: 6 }} />
      </div>

      {/* sub-tabs skeleton */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
        {[80, 90, 70, 60].map((w, i) => (
          <div key={i} className="animate-pulse rounded" style={{ height: 14, width: w, background: 'var(--surface-2)' }} />
        ))}
      </div>

      {/* search + counter + add button skeleton */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div className="animate-pulse rounded-lg" style={{ height: 38, flex: 1, maxWidth: 440, background: 'var(--surface-2)' }} />
        <div className="animate-pulse rounded" style={{ height: 14, width: 140, background: 'var(--surface-2)' }} />
        <div className="animate-pulse rounded-lg" style={{ height: 38, width: 200, background: 'var(--surface-2)' }} />
        <div className="animate-pulse rounded-lg" style={{ height: 38, width: 100, background: 'var(--accent-soft)' }} />
      </div>

      {/* card grid skeleton (3 cards matching obs-grid) */}
      <div className="obs-grid">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              borderRadius: 14,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              overflow: 'hidden',
            }}
          >
            {/* card-pad */}
            <div style={{ padding: '14px 18px' }}>
              {/* avatar + name */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div className="animate-pulse" style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface-2)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="animate-pulse rounded" style={{ height: 15, width: '60%', background: 'var(--surface-2)' }} />
                  <div className="animate-pulse rounded" style={{ height: 11, width: '40%', background: 'var(--surface-2)', marginTop: 4 }} />
                </div>
              </div>
              {/* metrics */}
              <div style={{ display: 'flex', gap: 14, marginTop: 14 }}>
                <div>
                  <div className="animate-pulse rounded" style={{ height: 10, width: 70, background: 'var(--surface-2)' }} />
                  <div className="animate-pulse rounded" style={{ height: 16, width: 50, background: 'var(--surface-2)', marginTop: 4 }} />
                </div>
                <div>
                  <div className="animate-pulse rounded" style={{ height: 10, width: 70, background: 'var(--surface-2)' }} />
                  <div className="animate-pulse rounded" style={{ height: 16, width: 80, background: 'var(--surface-2)', marginTop: 4 }} />
                </div>
              </div>
              {/* vs-you */}
              <div className="animate-pulse rounded" style={{ height: 12, width: '80%', background: 'var(--surface-2)', marginTop: 14 }} />
            </div>
            {/* shelf */}
            <div style={{ padding: '11px 20px 16px', background: 'rgba(0,0,0,0.12)', borderTop: '1px solid var(--border-subtle)' }}>
              <div className="animate-pulse rounded" style={{ height: 10, width: 100, background: 'var(--surface-2)', marginBottom: 8 }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[0, 1, 2].map(j => (
                  <div key={j} className="animate-pulse rounded-md" style={{ aspectRatio: '16/9', background: 'var(--surface-2)' }} />
                ))}
              </div>
              <div className="animate-pulse rounded-lg" style={{ height: 36, width: '100%', background: 'var(--surface-2)', marginTop: 12 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
