import type { ClicksDestination } from '../types'

const DESTINATIONS: { key: keyof ClicksDestination; label: string; color: string }[] = [
  { key: 'inHouse', label: 'In-house', color: '#38bdf8' },  // sky-400
  { key: 'external', label: 'External', color: '#60a5fa' },  // blue-400
  { key: 'youtube', label: 'YouTube', color: '#fb7185' },    // rose-400
  { key: 'affiliate', label: 'Affiliate', color: '#fbbf24' }, // amber-400
]

interface Props {
  data: ClicksDestination
}

export function ClicksDestinationGrid({ data }: Props) {
  const total = data.inHouse + data.external + data.youtube + data.affiliate

  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface p-4" data-testid="clicks-destination">
      <h3 className="mb-3 text-sm font-medium text-cms-text-dim">Click Destinations</h3>
      <div className="grid grid-cols-2 gap-3">
        {DESTINATIONS.map(({ key, label, color }) => {
          const count = data[key]
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <div
              key={key}
              className="rounded-lg p-3"
              style={{ backgroundColor: `${color}10`, borderLeft: `3px solid ${color}` }}
            >
              <p className="text-xl font-bold tabular-nums text-cms-text">{count}</p>
              <p className="mt-0.5 text-xs text-cms-text-muted">
                {label} <span className="text-[10px]">({pct}%)</span>
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
