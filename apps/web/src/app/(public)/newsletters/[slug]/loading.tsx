export default function NewsletterLandingLoading() {
  const shimmer =
    'animate-pulse rounded-md bg-gradient-to-r from-[var(--pb-paper)] via-[var(--pb-paper2)] to-[var(--pb-paper)]'

  return (
    <div aria-busy="true" aria-label="Loading newsletter" style={{ padding: '24px 28px' }}>
      {/* Breadcrumb shimmer */}
      <div className={shimmer} style={{ width: 200, height: 14, marginBottom: 40 }} />

      {/* Hero grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 56, marginBottom: 48 }}>
        {/* Left: content */}
        <div>
          <div className={shimmer} style={{ width: 80, height: 20, marginBottom: 16, borderRadius: 4 }} />
          <div className={shimmer} style={{ width: '90%', height: 64, marginBottom: 12 }} />
          <div className={shimmer} style={{ width: '70%', height: 24, marginBottom: 16 }} />
          <div className={shimmer} style={{ width: '100%', height: 80, marginBottom: 24 }} />
          <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
            <div className={shimmer} style={{ width: 100, height: 48 }} />
            <div className={shimmer} style={{ width: 100, height: 48 }} />
            <div className={shimmer} style={{ width: 100, height: 48 }} />
          </div>
          <div className={shimmer} style={{ width: '80%', height: 120 }} />
        </div>
        {/* Right: form */}
        <div>
          <div className={shimmer} style={{ width: '100%', height: 360, borderRadius: 8 }} />
        </div>
      </div>
    </div>
  )
}
