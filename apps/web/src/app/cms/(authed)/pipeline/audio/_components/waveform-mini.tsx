'use client'

import { resamplePeaks } from './waveform'

interface WaveformMiniProps {
  peaks: number[]
  width?: number
  height?: number
}

export function WaveformMini({ peaks, width = 80, height = 24 }: WaveformMiniProps) {
  const sampled = resamplePeaks(peaks ?? [], 40)
  const cy = height / 2
  const barWidth = Math.max(1, width / 40 - 0.5)

  if (sampled.length === 0) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
        <rect x={0} y={cy - 1} width={width} height={2} fill="#6b7280" opacity={0.3} rx={1} />
      </svg>
    )
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      <defs>
        <linearGradient id="wf-mini" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#e879f9" />
        </linearGradient>
      </defs>
      {sampled.map((peak, i) => {
        const x = i * (barWidth + 0.5)
        const amp = Math.max(1, peak * cy)
        return (
          <g key={i} opacity={0.6 + peak * 0.4}>
            <rect x={x} y={cy - amp} width={barWidth} height={amp} fill="url(#wf-mini)" />
            <rect x={x} y={cy} width={barWidth} height={amp} fill="url(#wf-mini)" />
          </g>
        )
      })}
    </svg>
  )
}
