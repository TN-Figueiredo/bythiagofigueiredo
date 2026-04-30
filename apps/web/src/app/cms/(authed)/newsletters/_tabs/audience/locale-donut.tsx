'use client'

interface LocaleDonutProps {
  locale: Record<string, number>
}

const LOCALE_COLORS: Record<string, string> = {
  'pt-BR': '#6366f1',
  'en': '#22c55e',
  'unknown': '#9ca3af',
}

export function LocaleDonut({ locale }: LocaleDonutProps) {
  const entries = Object.entries(locale).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((s, [, v]) => s + v, 0)
  if (total === 0) return null

  const radius = 30
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="rounded-[10px] border border-gray-800 bg-gray-900 p-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Locale Distribution</h3>
      <div className="flex items-center gap-4">
        <svg width={80} height={80} className="-rotate-90">
          <circle cx={40} cy={40} r={radius} fill="none" stroke="#1f2937" strokeWidth={10} />
          {entries.map(([key, count]) => {
            const pct = count / total
            const dash = pct * circumference
            const seg = (
              <circle
                key={key}
                cx={40} cy={40} r={radius}
                fill="none"
                stroke={LOCALE_COLORS[key] ?? '#6b7280'}
                strokeWidth={10}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              />
            )
            offset += dash
            return seg
          })}
        </svg>
        <div className="space-y-1">
          {entries.map(([key, count]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LOCALE_COLORS[key] ?? '#6b7280' }} />
              <span className="text-[10px] text-gray-300">{key}</span>
              <span className="text-[9px] tabular-nums text-gray-500">{((count / total) * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
