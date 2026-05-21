export default function Loading() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        background: 'var(--pb-bg, #1A1714)',
        position: 'relative',
        isolation: 'isolate',
      }}
      aria-busy="true"
      aria-label="Carregando…"
    >
      <style>{`
        @media (max-width: 560px) {
          .unsub-loading-inner { padding: 36px 28px 32px !important; }
        }
      `}</style>

      {/* Grain texture (matches the unsubscribe page) */}
      <svg
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          opacity: 0.35,
        }}
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <filter id="unsub-loading-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#unsub-loading-grain)" />
      </svg>

      {/* Content column */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 520,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* TF monogram placeholder (text-width, matches Monogram component) */}
        <div
          className="animate-pulse"
          style={{
            marginBottom: 32,
            height: 44,
            width: 80,
            borderRadius: 4,
            background: 'var(--pb-line, #332D25)',
          }}
        />

        {/* Card skeleton */}
        <div
          style={{
            width: '100%',
            background: 'var(--pb-paper, #221E1A)',
            borderRadius: 6,
            boxShadow: 'var(--pb-shadow-card, 0 2px 0 rgba(0,0,0,0.5), 0 12px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.03))',
            overflow: 'hidden',
          }}
        >
          {/* Top stripe placeholder */}
          <div
            style={{
              height: 4,
              background: 'var(--pb-line, #332D25)',
              borderRadius: '6px 6px 0 0',
            }}
          />

          {/* Card inner */}
          <div
            style={{ padding: '48px 48px 44px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            className="unsub-loading-inner"
          >
            {/* Icon circle placeholder */}
            <div
              className="animate-pulse"
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'var(--pb-line, #332D25)',
                marginBottom: 24,
              }}
            />

            {/* Thin divider (matches iconDivider) */}
            <div
              style={{
                width: 32,
                height: 1,
                background: 'var(--pb-line, #332D25)',
                marginBottom: 24,
              }}
            />

            {/* Title placeholder */}
            <div
              className="animate-pulse"
              style={{
                height: 28,
                width: 192,
                borderRadius: 4,
                background: 'var(--pb-line, #332D25)',
                marginBottom: 14,
              }}
            />

            {/* Body text placeholders */}
            <div
              className="animate-pulse"
              style={{
                height: 16,
                width: 256,
                borderRadius: 4,
                background: 'var(--pb-line, #332D25)',
                marginBottom: 8,
              }}
            />
            <div
              className="animate-pulse"
              style={{
                height: 16,
                width: 224,
                borderRadius: 4,
                background: 'var(--pb-line, #332D25)',
                marginBottom: 28,
              }}
            />

            {/* Button placeholder */}
            <div
              className="animate-pulse"
              style={{
                height: 40,
                width: 160,
                borderRadius: 4,
                background: 'var(--pb-line, #332D25)',
                marginBottom: 28,
              }}
            />

            {/* Card divider */}
            <div
              style={{
                width: '100%',
                height: 1,
                background: 'var(--pb-line, #332D25)',
                marginBottom: 24,
              }}
            />

            {/* Home link placeholder */}
            <div
              className="animate-pulse"
              style={{
                height: 12,
                width: 112,
                borderRadius: 4,
                background: 'var(--pb-line, #332D25)',
              }}
            />

            {/* End mark */}
            <div
              style={{ marginTop: 36, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 }}
              aria-hidden="true"
            >
              <div style={{ width: 36, height: 1, background: 'var(--pb-line, #332D25)' }} />
              <span style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 16, color: 'var(--pb-accent, #FF8240)', lineHeight: 1 }}>❦</span>
              <div style={{ width: 36, height: 1, background: 'var(--pb-line, #332D25)' }} />
            </div>

            {/* Signature */}
            <div
              style={{ marginTop: 16, textAlign: 'center' }}
              aria-hidden="true"
            >
              <p
                style={{
                  fontFamily: "'Source Serif 4', Georgia, serif",
                  fontSize: 13,
                  color: 'var(--pb-faint, #6B634F)',
                  lineHeight: 1.4,
                  margin: 0,
                }}
              >
                <span style={{ fontStyle: 'italic', fontWeight: 300, opacity: 0.7 }}>tf</span>
                {' '}
                <span style={{ color: 'var(--pb-accent, #FF8240)' }}>❦</span>
                {' '}
                <span style={{ fontWeight: 500 }}>Thiago Figueiredo</span>
              </p>
              <p
                style={{
                  fontFamily: "'Inter', Arial, sans-serif",
                  fontSize: 11,
                  color: 'var(--pb-faint, #6B634F)',
                  marginTop: 2,
                  letterSpacing: '0.02em',
                }}
              >
                bythiagofigueiredo.com
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
