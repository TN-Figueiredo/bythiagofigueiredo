'use client'

export function AudioGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 340px))',
      gap: 14,
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          borderRadius: 8, overflow: 'hidden',
          border: '1px solid var(--gem-border)', background: 'var(--gem-surface)',
        }}>
          <div style={{
            height: 64,
            backgroundImage: 'linear-gradient(90deg, var(--gem-well) 25%, var(--gem-surface) 50%, var(--gem-well) 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            animationDelay: `${i * 0.2}s`,
          }} />
          <div style={{ padding: '10px 12px 12px' }}>
            <div style={{
              height: 12, width: '80%', borderRadius: 4, marginBottom: 6,
              backgroundImage: 'linear-gradient(90deg, var(--gem-well) 25%, var(--gem-surface) 50%, var(--gem-well) 75%)',
              backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
            }} />
            <div style={{
              height: 10, width: '60%', borderRadius: 4, marginBottom: 10,
              backgroundImage: 'linear-gradient(90deg, var(--gem-well) 25%, var(--gem-surface) 50%, var(--gem-well) 75%)',
              backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
            }} />
            <div style={{
              height: 10, width: '40%', borderRadius: 4,
              backgroundImage: 'linear-gradient(90deg, var(--gem-well) 25%, var(--gem-surface) 50%, var(--gem-well) 75%)',
              backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function AudioFilterSkeleton() {
  return (
    <div style={{
      width: 280, borderRadius: 10, padding: 14,
      border: '1px solid var(--gem-border)', background: 'var(--gem-surface)',
    }}>
      {[120, 80, 100, 60, 90].map((w, i) => (
        <div key={i} style={{
          height: 28, width: w, borderRadius: 6, marginBottom: 12,
          backgroundImage: 'linear-gradient(90deg, var(--gem-well) 25%, var(--gem-surface) 50%, var(--gem-well) 75%)',
          backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
        }} />
      ))}
    </div>
  )
}
