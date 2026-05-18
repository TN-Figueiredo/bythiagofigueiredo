'use client'

import { memo, useId } from 'react'

type Variant = 'card' | 'detail'

interface FrameData {
  url: string
  timestamp: number
}

interface FrameStripProps {
  variant: Variant
  frames: FrameData[] | null
  duration: number | null
  resolution: string | null
  thumbnailUrl?: string | null
}

const VARIANT_CONFIG = {
  card: { height: 80 },
  detail: { height: 100, frameCount: 5 },
} as const

/** Film-frame SVG icon used as placeholder */
function FilmIcon({ size = 28, opacity = 0.15 }: { size?: number; opacity?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity, color: 'var(--gem-muted)' }}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
      <line x1="7" y1="2" x2="7" y2="22" />
      <line x1="17" y1="2" x2="17" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="2" y1="7" x2="7" y2="7" />
      <line x1="2" y1="17" x2="7" y2="17" />
      <line x1="17" y1="7" x2="22" y2="7" />
      <line x1="17" y1="17" x2="22" y2="17" />
    </svg>
  )
}

function FrameStripInner({ variant, frames, duration, resolution, thumbnailUrl }: FrameStripProps) {
  const id = useId()
  const config = VARIANT_CONFIG[variant]
  const hasFrames = frames != null && frames.length > 0
  const hasThumbnail = thumbnailUrl != null && thumbnailUrl !== ''

  // ── Card variant ───────────────────────────────────────────────
  if (variant === 'card') {
    const bgStyle: React.CSSProperties = hasThumbnail
      ? {
          backgroundImage: `url(${thumbnailUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : {
          background: 'linear-gradient(135deg, #1e293b, #0f172a)',
        }

    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: config.height,
          overflow: 'hidden',
          ...bgStyle,
        }}
        aria-hidden="true"
      >
        {/* Centered film icon when no thumbnail */}
        {!hasThumbnail && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FilmIcon size={28} opacity={0.15} />
          </div>
        )}

        {/* Resolution badge — top-right */}
        {resolution && (
          <span
            style={{
              position: 'absolute',
              top: 4,
              right: 6,
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: 'rgba(255,255,255,0.7)',
              background: 'rgba(0,0,0,0.5)',
              borderRadius: 3,
              padding: '1px 4px',
              lineHeight: 1.4,
              textTransform: 'uppercase',
              pointerEvents: 'none',
            }}
          >
            {resolution === '4k' ? '4K' : resolution}
          </span>
        )}
      </div>
    )
  }

  // ── Detail variant ─────────────────────────────────────────────
  const frameCount = 'frameCount' in config ? config.frameCount : 5

  if (!hasFrames) {
    // Placeholder: 5 gradient boxes with film icon
    return (
      <div>
        <div
          style={{
            display: 'flex',
            gap: 2,
            height: config.height,
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          {Array.from({ length: frameCount }, (_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'pulse-subtle 1.6s ease-in-out infinite',
                animationDelay: `${i * 0.12}s`,
              }}
            >
              <FilmIcon size={16} opacity={0.12} />
            </div>
          ))}
        </div>
        {/* Progress bar placeholder */}
        <div
          style={{
            height: 2,
            borderRadius: 1,
            marginTop: 4,
            background: 'var(--gem-border)',
          }}
        />
        <span
          style={{
            display: 'block',
            textAlign: 'center',
            fontSize: 8,
            color: '#5a6b7f',
            marginTop: 2,
          }}
        >
          Frame strip available after processing
        </span>
      </div>
    )
  }

  // Real frames
  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 2,
          height: config.height,
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        {frames.slice(0, frameCount).map((frame, i) => (
          <div
            key={`${id}-frame-${i}`}
            style={{
              flex: 1,
              backgroundImage: `url(${frame.url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                bottom: 2,
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: 8,
                color: 'rgba(255,255,255,0.5)',
                background: 'rgba(0,0,0,0.4)',
                borderRadius: 2,
                padding: '0px 3px',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}
            >
              {frame.timestamp.toFixed(1)}s
            </span>
          </div>
        ))}
      </div>

      {/* Progress bar with frame position markers */}
      <div
        style={{
          position: 'relative',
          height: 2,
          borderRadius: 1,
          marginTop: 4,
          background: 'var(--gem-border)',
        }}
      >
        {duration != null && duration > 0 && frames.map((frame, i) => {
          const pct = Math.min((frame.timestamp / duration) * 100, 100)
          return (
            <div
              key={`${id}-marker-${i}`}
              style={{
                position: 'absolute',
                left: `${pct}%`,
                top: -1,
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: 'var(--gem-accent)',
                transform: 'translateX(-50%)',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

export const FrameStrip = memo(FrameStripInner)
