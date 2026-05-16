import type { InsightCard } from '@/lib/analytics/insights-engine'

const COLOR_MAP: Record<string, string> = {
  red: '#f87171',
  green: '#34d399',
  indigo: '#818cf8',
}

interface Props {
  insights: InsightCard[]
}

export function InsightsStrip({ insights }: Props) {
  if (insights.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="insights-strip">
      {insights.map((card) => {
        const color = COLOR_MAP[card.color] ?? '#9ca3af'
        return (
          <div
            key={card.id}
            className="group cursor-pointer rounded-lg border border-cms-border bg-cms-surface p-4 transition-colors hover:border-cms-text-muted"
          >
            <div className="flex items-start gap-2">
              <span
                className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-cms-text">{card.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-cms-text-muted">{card.body}</p>
              </div>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                className="mt-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                fill="none"
                aria-hidden="true"
              >
                <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.5" className="text-cms-text-muted" />
              </svg>
            </div>
          </div>
        )
      })}
    </div>
  )
}
