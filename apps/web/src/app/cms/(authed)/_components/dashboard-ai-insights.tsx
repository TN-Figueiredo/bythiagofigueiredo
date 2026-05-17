interface Insight {
  type: 'anomaly' | 'pattern' | 'opportunity'
  message: string
  actions: { label: string; href: string }[]
}

interface Props {
  insights: Insight[]
}

const TYPE_STYLES: Record<string, { border: string; label: string }> = {
  anomaly: { border: 'border-l-green-400', label: 'Anomaly' },
  pattern: { border: 'border-l-amber-400', label: 'Pattern' },
  opportunity: { border: 'border-l-blue-400', label: 'Opportunity' },
}

export function DashboardAiInsights({ insights }: Props) {
  if (insights.length === 0) return null

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-cms-text">AI Insights</h3>
      {insights.map((insight, i) => {
        const style = TYPE_STYLES[insight.type]!
        return (
          <div key={i} className={`rounded-lg border border-cms-border ${style.border} border-l-4 bg-cms-surface p-3`}>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-cms-text-muted">{style.label}</span>
            </div>
            <p className="text-xs text-cms-text">{insight.message}</p>
            {insight.actions.length > 0 && (
              <div className="mt-2 flex gap-2">
                {insight.actions.map((action) => (
                  <a
                    key={action.label}
                    href={action.href}
                    className="rounded px-2 py-1 text-[10px] font-medium text-[var(--acc)] hover:bg-[var(--acc)]/10"
                  >
                    {action.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
