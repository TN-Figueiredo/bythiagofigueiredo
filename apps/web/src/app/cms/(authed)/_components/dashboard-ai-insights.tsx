import type { InsightCard } from '@/lib/analytics/insights-engine'

interface Props {
  insights: InsightCard[]
}

const COLOR_STYLES: Record<string, { border: string; label: string }> = {
  red: { border: 'border-l-red-400', label: 'Warning' },
  green: { border: 'border-l-green-400', label: 'Winning' },
  indigo: { border: 'border-l-blue-400', label: 'Opportunity' },
}

export function DashboardAiInsights({ insights }: Props) {
  if (insights.length === 0) return null

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-cms-text">AI Insights</h3>
      {insights.map((insight) => {
        const style = COLOR_STYLES[insight.color] ?? COLOR_STYLES['green']!
        return (
          <div key={insight.id} className={`rounded-lg border border-cms-border ${style.border} border-l-4 bg-cms-surface p-3`}>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-cms-text-muted">{style.label}</span>
            </div>
            <p className="text-xs font-medium text-cms-text">{insight.title}</p>
            <p className="mt-0.5 text-xs text-cms-text-muted">{insight.body}</p>
          </div>
        )
      })}
    </div>
  )
}
