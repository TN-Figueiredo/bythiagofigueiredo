'use client'
import type { Insight } from '../types'

export interface AiInsightsPanelProps {
  insights: Insight[]
  isLoading: boolean
}

const SEVERITY_STYLES = {
  positive: 'border-green-200 dark:border-green-900/30 bg-green-100 dark:bg-green-900/30',
  warning: 'border-amber-200 dark:border-amber-900/30 bg-yellow-100 dark:bg-yellow-900/30',
  info: 'border-blue-200 dark:border-blue-900/30 bg-primary/10',
}

const SEVERITY_ICONS = {
  positive: '↑',
  warning: '!',
  info: 'i',
}

const MAX_INSIGHTS = 5

export function AiInsightsPanel({ insights, isLoading }: AiInsightsPanelProps) {
  if (isLoading) {
    return (
      <div data-testid="insights-loading" className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  if (insights.length === 0) {
    return (
      <div className="rounded-lg border bg-muted p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No insights available yet. Insights appear when enough click data is collected.
        </p>
      </div>
    )
  }

  const displayed = insights.slice(0, MAX_INSIGHTS)

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">AI Insights</h3>
      {displayed.map((insight) => (
        <div
          key={insight.id}
          data-testid="insight-card"
          className={`rounded-lg border p-3 ${SEVERITY_STYLES[insight.severity]}`}
        >
          <div className="flex items-start gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-card text-xs font-bold">
              {SEVERITY_ICONS[insight.severity]}
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{insight.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{insight.description}</p>
              <div className="mt-2 flex items-center gap-1">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${insight.confidence * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {Math.round(insight.confidence * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
