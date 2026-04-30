'use client'

interface HealthGaugeProps {
  score: number
  dimensions: Record<string, { score: number; label: string }>
}

function getColor(score: number): string {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#6366f1'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

export function HealthGauge({ score, dimensions }: HealthGaugeProps) {
  const radius = 40
  const stroke = 8
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (score / 100) * circumference
  const color = getColor(score)

  return (
    <div className="rounded-[10px] border border-gray-800 bg-gray-900 p-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Health Score</h3>
      <div className="flex items-center gap-6">
        <div className="relative">
          <svg width={100} height={100} className="-rotate-90">
            <circle cx={50} cy={50} r={radius} fill="none" stroke="#1f2937" strokeWidth={stroke} />
            <circle
              cx={50} cy={50} r={radius} fill="none"
              stroke={color} strokeWidth={stroke}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-lg font-extrabold tabular-nums text-gray-100">{score}</span>
        </div>
        <div className="flex-1 space-y-1.5">
          {Object.entries(dimensions).map(([key, dim]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-24 text-[10px] text-gray-400 capitalize">{key}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-800">
                <div className="h-full rounded-full transition-all" style={{ width: `${dim.score}%`, backgroundColor: getColor(dim.score) }} />
              </div>
              <span className="w-8 text-right text-[9px] tabular-nums text-gray-500">{dim.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
