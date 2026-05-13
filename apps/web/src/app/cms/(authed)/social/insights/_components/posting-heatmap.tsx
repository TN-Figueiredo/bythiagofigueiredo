import type { SocialStrings } from '../../_i18n/types'

interface HeatmapCell {
  day: number
  hour: number
  value: number
}

interface PostingHeatmapProps {
  data: HeatmapCell[]
  strings: SocialStrings
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function PostingHeatmap({ data, strings: t }: PostingHeatmapProps) {
  const maxVal = Math.max(...data.map(d => d.value), 1)

  function intensity(value: number): string {
    const pct = value / maxVal
    if (pct > 0.8) return 'bg-green-500'
    if (pct > 0.6) return 'bg-green-600/70'
    if (pct > 0.3) return 'bg-green-700/40'
    if (pct > 0) return 'bg-green-800/20'
    return 'bg-gray-800'
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-cms-text mb-3">{t.insights.heatmap.title}</h3>
      <div className="overflow-x-auto">
        <div className="inline-grid gap-px" style={{ gridTemplateColumns: `auto repeat(24, 1fr)` }}>
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-center text-[9px] text-cms-text-dim w-5">{h}</div>
          ))}
          {DAYS.map((day, dayIdx) => (
            <div key={`row-${dayIdx}`} className="contents">
              <div className="text-[10px] text-cms-text-dim pr-1 flex items-center">{day}</div>
              {Array.from({ length: 24 }, (_, hour) => {
                const cell = data.find(d => d.day === dayIdx && d.hour === hour)
                return (
                  <div
                    key={`${dayIdx}-${hour}`}
                    className={`h-5 w-5 rounded-sm ${intensity(cell?.value ?? 0)}`}
                    title={`${day} ${hour}:00 — ${(cell?.value ?? 0).toFixed(1)}`}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
