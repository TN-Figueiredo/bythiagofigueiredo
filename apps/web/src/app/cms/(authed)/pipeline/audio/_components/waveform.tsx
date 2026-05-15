'use client'

export function resamplePeaks(peaks: number[], targetCount: number): number[] {
  if (peaks.length === 0) return []
  if (peaks.length <= targetCount) return peaks
  const result: number[] = []
  for (let i = 0; i < targetCount; i++) {
    const pos = (i / (targetCount - 1)) * (peaks.length - 1)
    const lo = Math.floor(pos)
    const hi = Math.min(lo + 1, peaks.length - 1)
    const t = pos - lo
    result.push(peaks[lo] * (1 - t) + peaks[hi] * t)
  }
  return result
}

function peakOpacity(v: number): number {
  const val = Math.max(0, Math.min(1, v))
  if (val <= 0.25) return 0.25 + (val / 0.25) * 0.15
  if (val <= 0.50) return 0.40 + ((val - 0.25) / 0.25) * 0.25
  if (val <= 0.75) return 0.65 + ((val - 0.50) / 0.25) * 0.20
  return 0.85 + ((val - 0.75) / 0.25) * 0.15
}

const COLORS = {
  purple: { from: '#7c3aed', to: '#e879f9' },
  cyan: { from: '#0ea5e9', to: '#67e8f9' },
}

interface WaveformProps {
  peaks: number[]
  width?: number
  height?: number
  color?: 'purple' | 'cyan'
  duration?: number
}

export function Waveform({ peaks, width = 320, height = 80, color = 'purple', duration }: WaveformProps) {
  const stops = COLORS[color]
  const cy = height / 2

  const rawCount = duration != null
    ? Math.max(20, Math.min(Math.floor(duration * 2.5), 400))
    : Math.min(peaks?.length || 60, 400)
  const sampled = resamplePeaks(peaks ?? [], rawCount)
  const barWidth = Math.max(1, width / rawCount - (width / rawCount < 2 ? 0.5 : 1))
  const gap = barWidth < 2 ? 0.5 : 1

  if (!peaks || peaks.length === 0) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-label="Waveform available after download" role="img">
        <defs>
          <linearGradient id="wf-ph" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={stops.from} stopOpacity="0.15" />
            <stop offset="50%" stopColor={stops.to} stopOpacity="0.35">
              <animate attributeName="stopOpacity" values="0.15;0.45;0.15" dur="1.6s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor={stops.from} stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <rect x={0} y={cy - 2} width={width} height={4} fill="url(#wf-ph)" rx={2} />
      </svg>
    )
  }

  const gradId = `wf-${color}`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-label="Audio waveform" role="img">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={stops.from} />
          <stop offset="100%" stopColor={stops.to} />
        </linearGradient>
      </defs>
      {sampled.map((peak, i) => {
        const x = i * (barWidth + gap)
        const amp = Math.max(1, peak * cy)
        return (
          <g key={i} opacity={peakOpacity(peak)}>
            <rect x={x} y={cy - amp} width={barWidth} height={amp} fill={`url(#${gradId})`} rx={barWidth < 3 ? 0 : 1} />
            <rect x={x} y={cy} width={barWidth} height={amp} fill={`url(#${gradId})`} rx={barWidth < 3 ? 0 : 1} />
          </g>
        )
      })}
      {duration != null && (
        <>
          <text x={0} y={height - 2} fontSize={8} fill={stops.from} opacity={0.6}>0s</text>
          <text x={width} y={height - 2} fontSize={8} fill={stops.to} opacity={0.6} textAnchor="end">{Math.round(duration)}s</text>
        </>
      )}
    </svg>
  )
}
