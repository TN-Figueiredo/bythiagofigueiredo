'use client'

import { memo, useId } from 'react'
import { resamplePeaks } from './waveform'
import { energyColor } from '../_helpers/audio-helpers'

type Variant = 'card' | 'table' | 'detail'
type AudioType = 'music' | 'sfx'

interface WaveformDisplayProps {
  variant: Variant
  peaks: number[]
  energy?: number | null
  type?: AudioType
  duration?: number | null
}

const VARIANT_CONFIG = {
  card: { height: 64, barWidth: 4, gap: 2, defaultBars: 32 },
  table: { height: 20, barWidth: 2, gap: 1, defaultBars: 14 },
  detail: { height: 72, barWidth: 5, gap: 1, defaultBars: 60 },
} as const

const SHIMMER_HEIGHTS_CARD = [10, 18, 28, 22, 36, 44, 32, 24, 38, 18, 28, 14, 20, 30, 12, 22, 16]
const SHIMMER_HEIGHTS_DETAIL = [20, 34, 48, 40, 56, 62, 50, 38, 52, 28]

const BASE_COLORS = { music: '#a78bfa', sfx: '#22d3ee' } as const

function WaveformDisplayInner({ variant, peaks, energy, type = 'music', duration }: WaveformDisplayProps) {
  const id = useId()
  const config = VARIANT_CONFIG[variant]
  const baseColor = BASE_COLORS[type]
  const eColor = energyColor(energy)
  const hasPeaks = peaks.length > 0

  // Table variant — fixed 56x20 SVG
  if (variant === 'table') {
    return (
      <svg width="56" height="20" aria-hidden="true" style={{ display: 'block' }}>
        {!hasPeaks ? (
          <>
            <defs>
              <linearGradient id={`${id}-flat`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="50%" stopColor="#5a6b7f" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
            <rect
              x="6" y="9" width="44" height="2" rx="1"
              fill={`url(#${id}-flat)`} opacity="0.4"
              style={{ animation: 'pulse-subtle 2s ease-in-out infinite' }}
            />
          </>
        ) : (
          <>
            <defs>
              <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={baseColor} />
                <stop offset="100%" stopColor={type === 'sfx' ? '#06b6d4' : '#6366f1'} />
              </linearGradient>
            </defs>
            {resamplePeaks(peaks, 14).map((p, i) => {
              const h = Math.max(2, p * 16)
              const x = 1 + i * 4
              return (
                <g key={i} opacity={0.6 + p * 0.4}>
                  <rect x={x} y={10 - h / 2} width={2} height={h} rx={1} fill={`url(#${id}-g)`} />
                </g>
              )
            })}
          </>
        )}
      </svg>
    )
  }

  // Card and Detail variants
  const isCard = variant === 'card'
  const barCount = isCard ? config.defaultBars : Math.min(Math.max(40, config.defaultBars), 80)
  const totalWidth = barCount * (config.barWidth + config.gap)
  const cy = config.height / 2

  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: config.height,
    borderRadius: isCard ? undefined : 6,
    overflow: 'hidden',
    background: `linear-gradient(135deg, color-mix(in srgb, ${baseColor} 10%, #0c1222), color-mix(in srgb, ${eColor} ${isCard ? '5' : '8'}%, #0c1222))`,
  }

  // Shimmer placeholder
  if (!hasPeaks) {
    const shimmerHeights = isCard ? SHIMMER_HEIGHTS_CARD : SHIMMER_HEIGHTS_DETAIL
    const shimmerWidth = shimmerHeights.length * (config.barWidth + config.gap)
    return (
      <div style={wrapperStyle}>
        <svg
          width="100%" height={config.height} preserveAspectRatio="none" aria-hidden="true"
          viewBox={`0 0 ${shimmerWidth} ${config.height}`}
        >
          <defs>
            <linearGradient id={`${id}-sh`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          {shimmerHeights.map((h, i) => {
            const x = i * (config.barWidth + config.gap)
            const scaledH = (h / 64) * (config.height - 8)
            return (
              <rect
                key={i}
                x={x} y={cy - scaledH / 2}
                width={config.barWidth} height={scaledH} rx={2}
                fill={`url(#${id}-sh)`}
                style={{ animation: 'pulse-subtle 1.5s ease-in-out infinite', animationDelay: `${i * 0.08}s` }}
              />
            )
          })}
        </svg>
        {variant === 'detail' && (
          <span style={{
            position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
            fontSize: 8, color: '#5a6b7f',
          }}>
            Waveform available after download
          </span>
        )}
      </div>
    )
  }

  // Full waveform
  const resampled = resamplePeaks(peaks, barCount)

  return (
    <div style={wrapperStyle}>
      <svg
        width="100%" height={config.height} preserveAspectRatio="none" aria-hidden="true"
        viewBox={`0 0 ${totalWidth} ${config.height}`}
      >
        <defs>
          <linearGradient id={`${id}-bar`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={baseColor} />
            <stop offset="100%" stopColor={eColor} stopOpacity="0.6" />
          </linearGradient>
        </defs>
        {resampled.map((p, i) => {
          const maxH = cy - 4
          const h = Math.max(2, p * maxH)
          const x = i * (config.barWidth + config.gap)
          const opacity = 0.4 + p * 0.6
          return (
            <g key={i}>
              <rect x={x} y={cy - h} width={config.barWidth} height={h} rx={2}
                fill={`url(#${id}-bar)`} opacity={opacity} />
              <rect x={x} y={cy} width={config.barWidth} height={h * (variant === 'detail' ? 0.5 : 0.3)} rx={2}
                fill={`url(#${id}-bar)`} opacity={opacity * (variant === 'detail' ? 0.3 : 0.2)} />
            </g>
          )
        })}
      </svg>
      {variant === 'detail' && duration != null && (
        <span style={{
          position: 'absolute', bottom: 4, right: 8,
          fontSize: 10, color: '#5a6b7f', fontVariantNumeric: 'tabular-nums',
        }}>
          {Math.floor(duration / 60)}:{Math.round(duration % 60).toString().padStart(2, '0')}
        </span>
      )}
    </div>
  )
}

export const WaveformDisplay = memo(WaveformDisplayInner)
