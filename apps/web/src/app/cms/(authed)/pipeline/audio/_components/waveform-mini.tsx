'use client'

import { useId } from 'react'
import { resamplePeaks } from './waveform'

interface WaveformMiniProps {
  peaks: number[]
  width?: number
  height?: number
  color?: 'purple' | 'cyan'
}

export function WaveformMini({ peaks, width = 80, height = 24, color = 'purple' }: WaveformMiniProps) {
  const instanceId = useId()
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
        <linearGradient id={`wf-mini-${instanceId}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color === 'cyan' ? '#0ea5e9' : '#7c3aed'} />
          <stop offset="100%" stopColor={color === 'cyan' ? '#67e8f9' : '#e879f9'} />
        </linearGradient>
      </defs>
      {sampled.map((peak, i) => {
        const x = i * (barWidth + 0.5)
        const amp = Math.max(1, peak * cy)
        return (
          <g key={i} opacity={0.6 + peak * 0.4}>
            <rect x={x} y={cy - amp} width={barWidth} height={amp} fill={`url(#wf-mini-${instanceId})`} />
            <rect x={x} y={cy} width={barWidth} height={amp} fill={`url(#wf-mini-${instanceId})`} />
          </g>
        )
      })}
    </svg>
  )
}
