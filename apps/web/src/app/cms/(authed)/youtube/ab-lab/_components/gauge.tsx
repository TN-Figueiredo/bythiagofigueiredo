'use client'

export interface GaugeProps {
  /** Percentage value 0-100 */
  value: number
  /** Threshold for green color (default 95) */
  target?: number
}

const SIZE = 160
const CX = SIZE / 2
const CY = SIZE / 2
const R = 60
const STROKE_WIDTH = 14
const CIRCUMFERENCE = 2 * Math.PI * R

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

export function Gauge({ value, target = 95 }: GaugeProps) {
  const clamped = Number.isNaN(value) ? 0 : Math.min(100, Math.max(0, value))
  const isGreen = clamped >= target

  // Arc spans from -135° to 135° (270° total sweep)
  const START_ANGLE = -135
  const END_ANGLE = 135
  const SWEEP = END_ANGLE - START_ANGLE // 270°

  const fillAngle = START_ANGLE + (clamped / 100) * SWEEP
  const trackPath = arcPath(CX, CY, R, START_ANGLE, END_ANGLE)
  const valuePath = clamped > 0 ? arcPath(CX, CY, R, START_ANGLE, fillAngle) : null

  const arcColor = isGreen ? 'var(--cms-green)' : 'var(--color-accent, #3b82f6)'

  return (
    <div role="meter" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
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
          fontSize="20"
          fontWeight="bold"
          fill="currentColor"
        >
          {clamped}%
        </text>
      </svg>
    </div>
  )
}
