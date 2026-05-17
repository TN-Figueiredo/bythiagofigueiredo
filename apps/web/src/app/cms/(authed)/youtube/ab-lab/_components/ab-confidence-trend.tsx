'use client'

import { useMemo } from 'react'

interface AbConfidenceTrendProps {
  evaluations: { day: number; confidence: number }[]
  threshold?: number
  projected?: { day: number; confidence: number }[]
}

const PAD_LEFT = 30
const PAD_RIGHT = 10
const PAD_TOP = 20
const PAD_BOTTOM = 25
const SVG_HEIGHT = 160
const SVG_WIDTH = 600

function toX(day: number, minDay: number, maxDay: number): number {
  const range = maxDay - minDay || 1
  return PAD_LEFT + ((day - minDay) / range) * (SVG_WIDTH - PAD_LEFT - PAD_RIGHT)
}

function toY(confidence: number): number {
  return PAD_TOP + (1 - confidence) * (SVG_HEIGHT - PAD_TOP - PAD_BOTTOM)
}

function pointsString(data: { day: number; confidence: number }[], minDay: number, maxDay: number): string {
  return data.map(p => `${toX(p.day, minDay, maxDay).toFixed(2)},${toY(p.confidence).toFixed(2)}`).join(' ')
}

export function AbConfidenceTrend({ evaluations, threshold = 0.95, projected }: AbConfidenceTrendProps) {
  const { minDay, maxDay, evalPoints, projPoints, thresholdY, gridLines, lastEval } = useMemo(() => {
    const allPoints = [...(evaluations ?? []), ...(projected ?? [])]
    const days = allPoints.map(p => p.day)
    const minDay = days.length > 0 ? Math.min(...days) : 0
    const maxDay = days.length > 0 ? Math.max(...days) : 10

    const evalPoints = (evaluations ?? []).length > 0 ? pointsString(evaluations, minDay, maxDay) : ''
    const projPoints = (projected ?? []).length > 0 ? pointsString(projected!, minDay, maxDay) : ''

    const thresholdY = toY(threshold)

    const gridLines = [0.25, 0.5, 0.75].map(v => ({ y: toY(v), label: `${Math.round(v * 100)}%` }))

    const lastEval = evaluations && evaluations.length > 0 ? evaluations[evaluations.length - 1] : null

    return { minDay, maxDay, evalPoints, projPoints, thresholdY, gridLines, lastEval }
  }, [evaluations, projected, threshold])

  const xAxisDays = useMemo(() => {
    if (maxDay === minDay) return [minDay]
    const count = Math.min(maxDay - minDay + 1, 7)
    const step = Math.ceil((maxDay - minDay) / (count - 1 || 1))
    const days: number[] = []
    for (let d = minDay; d <= maxDay; d += step) days.push(d)
    if (days[days.length - 1] !== maxDay) days.push(maxDay)
    return days
  }, [minDay, maxDay])

  return (
    <div className="w-full" style={{ height: SVG_HEIGHT }}>
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        width="100%"
        height={SVG_HEIGHT}
        aria-label="Confidence trend chart"
      >
        {gridLines.map(({ y, label }) => (
          <g key={label}>
            <line
              x1={PAD_LEFT}
              y1={y}
              x2={SVG_WIDTH - PAD_RIGHT}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeWidth={1}
            />
            <text
              x={PAD_LEFT - 4}
              y={y + 4}
              textAnchor="end"
              fontSize={9}
              fill="currentColor"
              fillOpacity={0.4}
            >
              {label}
            </text>
          </g>
        ))}

        <line
          x1={PAD_LEFT}
          y1={thresholdY}
          x2={SVG_WIDTH - PAD_RIGHT}
          y2={thresholdY}
          stroke="#22c55e"
          strokeWidth={1.5}
          strokeDasharray="6,3"
          strokeOpacity={0.8}
        />
        <text
          x={SVG_WIDTH - PAD_RIGHT - 2}
          y={thresholdY - 4}
          textAnchor="end"
          fontSize={8}
          fill="#22c55e"
          fillOpacity={0.8}
        >
          {Math.round(threshold * 100)}%
        </text>

        {projPoints && (
          <polyline
            points={projPoints}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={1.5}
            strokeOpacity={0.4}
            strokeDasharray="4,4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {evalPoints && (
          <polyline
            points={evalPoints}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {lastEval && (() => {
          const cx = toX(lastEval.day, minDay, maxDay)
          const cy = toY(lastEval.confidence)
          const pct = Math.round(lastEval.confidence * 100)
          return (
            <g>
              <circle cx={cx} cy={cy} r={6} fill="#3b82f6" fillOpacity={0.25} />
              <circle cx={cx} cy={cy} r={3.5} fill="#3b82f6" />
              <text
                x={cx}
                y={cy - 10}
                textAnchor="middle"
                fontSize={10}
                fontWeight="bold"
                fill="#3b82f6"
              >
                {pct}%
              </text>
            </g>
          )
        })()}

        {xAxisDays.map(day => (
          <text
            key={day}
            x={toX(day, minDay, maxDay)}
            y={SVG_HEIGHT - 6}
            textAnchor="middle"
            fontSize={8}
            fill="currentColor"
            fillOpacity={0.35}
          >
            {`D${day}`}
          </text>
        ))}
      </svg>
    </div>
  )
}
