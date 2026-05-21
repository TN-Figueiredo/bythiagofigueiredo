export default function Loading() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 py-10 bg-[var(--pb-bg)]"
      aria-busy="true"
      aria-label="Carregando…"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
      }}
    >
      <style>{`
        @media (max-width: 560px) {
          .confirm-loading-card-body { padding: 36px 28px 32px !important; }
          .confirm-loading-monogram { width: 56px !important; }
        }
      `}</style>

      {/* Page wrapper — constrains all content to 520px */}
      <div style={{ maxWidth: 520, width: '100%' }}>

        {/* TF monogram placeholder */}
        <div className="flex justify-center" style={{ marginBottom: 32 }}>
          <div
            className="confirm-loading-monogram animate-pulse rounded"
            style={{ width: 80, height: 44, background: 'var(--pb-paper)' }}
          />
        </div>

        {/* Card skeleton */}
        <div
          className="w-full overflow-hidden rounded-md"
          style={{
            maxWidth: 520,
            background: 'var(--pb-paper)',
            boxShadow: 'var(--pb-shadow-card)',
          }}
        >
          {/* Top stripe placeholder */}
          <div
            className="w-full animate-pulse"
            style={{ height: 4, background: 'var(--pb-line)' }}
          />

          {/* Card body */}
          <div className="confirm-loading-card-body text-center flex flex-col items-center" style={{ padding: '48px 48px 44px' }}>
            {/* Icon circle placeholder */}
            <div
              className="w-14 h-14 rounded-full mb-5 animate-pulse"
              style={{ background: 'var(--pb-line)' }}
            />

            {/* Title placeholder */}
            <div
              className="h-7 w-48 rounded mb-4 animate-pulse"
              style={{ background: 'var(--pb-line)' }}
            />

            {/* Body text placeholders */}
            <div
              className="h-4 w-64 rounded mb-2 animate-pulse"
              style={{ background: 'var(--pb-line)' }}
            />
            <div
              className="h-4 w-56 rounded mb-8 animate-pulse"
              style={{ background: 'var(--pb-line)' }}
            />

            {/* Divider */}
            <div
              style={{ width: '100%', height: 1, background: 'var(--pb-line)', margin: '32px 0' }}
            />

            {/* Link placeholder */}
            <div
              className="h-3 w-28 rounded animate-pulse"
              style={{ background: 'var(--pb-line)' }}
            />

            {/* End mark — inside card */}
            <div className="flex items-center justify-center" style={{ marginTop: 36, gap: 14 }} aria-hidden="true">
              <span className="block" style={{ width: 36, height: 1, background: 'var(--pb-line)' }} />
              <span className="font-source-serif" style={{ fontSize: 16, color: 'var(--pb-accent)', lineHeight: 1, opacity: 0.4 }}>❦</span>
              <span className="block" style={{ width: 36, height: 1, background: 'var(--pb-line)' }} />
            </div>

            {/* Signature — inside card */}
            <div className="mt-4 text-center" aria-hidden="true">
              <p className="font-source-serif" style={{ fontSize: 13, color: 'var(--pb-faint)', lineHeight: 1.4, margin: 0 }}>
                <span style={{ fontStyle: 'italic', fontWeight: 300, opacity: 0.7 }}>tf</span>
                {' '}
                <span style={{ color: 'var(--pb-accent)' }}>❦</span>
                {' '}
                <span style={{ fontWeight: 500 }}>Thiago Figueiredo</span>
              </p>
              <p className="font-inter" style={{ fontSize: 11, color: 'var(--pb-faint)', marginTop: 2, letterSpacing: '0.02em' }}>
                bythiagofigueiredo.com
              </p>
            </div>

          </div>
        </div>

      </div>
    </main>
  )
}
