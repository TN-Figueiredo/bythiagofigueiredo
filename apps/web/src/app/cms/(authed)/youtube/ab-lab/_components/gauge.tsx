'use client'

export interface GaugeProps {
  /** Percentage value 0-100 */
  value: number
  /** Threshold for green color (default 95) */
  target?: number
  /** SVG size in px (default 132, was hardcoded 160). */
  size?: number
  /** Custom arc color override (CSS value). Falls back to accent/green logic. */
  color?: string
  /** Force green arc regardless of value vs target. */
  reached?: boolean
  /** Accessible label for the meter (default "Confidence") */
  ariaLabel?: string
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`
}

export function Gauge({
  value,
  target = 95,
  size = 132,
  color,
  reached,
  ariaLabel = 'Confidence',
}: GaugeProps) {
  const clamped = Number.isNaN(value) ? 0 : Math.min(100, Math.max(0, value))
  const isGreen = reached ?? clamped >= target

  // Compute geometry from size
  const CX = size / 2
  const CY = size / 2
  const R = size * 0.375 // 60/160 ratio preserved
  const STROKE_WIDTH = size * 0.0875 // 14/160 ratio preserved

  // Arc spans from -135deg to 135deg (270deg total sweep)
  const START_ANGLE = -135
  const END_ANGLE = 135
  const SWEEP = END_ANGLE - START_ANGLE // 270deg

  const fillAngle = START_ANGLE + (clamped / 100) * SWEEP
  const trackPath = arcPath(CX, CY, R, START_ANGLE, END_ANGLE)
  const valuePath = clamped > 0 ? arcPath(CX, CY, R, START_ANGLE, fillAngle) : null

  const arcColor = color ?? (isGreen ? 'var(--cms-green)' : 'var(--color-accent, #3b82f6)')

  // Text size scales with gauge size
  const fontSize = Math.round(size * 0.125) // 20/160

  return (
    <div role="meter" aria-label={ariaLabel} aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${clamped}%`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        {/* Track (gray background arc) */}
        <path
          d={trackPath}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
        />

        {/* Value arc */}
        {valuePath && (
          <path
            data-arc
            d={valuePath}
            fill="none"
            stroke={arcColor}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
          />
        )}

        {/* Centered value text */}
        <text
          x={CX}
          y={CY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={fontSize}
          fontWeight="bold"
          fill="currentColor"
        >
          {clamped}%
        </text>
      </svg>
    </div>
  )
}
