'use client'
import type { Insight } from '../types'

export interface AiInsightsPanelProps {
  insights: Insight[]
  isLoading: boolean
}

const SEVERITY_STYLES = {
  positive: 'border-green-200 bg-green-50',
  warning: 'border-amber-200 bg-amber-50',
  info: 'border-blue-200 bg-blue-50',
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
          <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    )
  }

  if (insights.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-500">
          No insights available yet. Insights appear when enough click data is collected.
        </p>
      </div>
    )
  }

  const displayed = insights.slice(0, MAX_INSIGHTS)

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">AI Insights</h3>
      {displayed.map((insight) => (
        <div
          key={insight.id}
          data-testid="insight-card"
          className={`rounded-lg border p-3 ${SEVERITY_STYLES[insight.severity]}`}
        >
          <div className="flex items-start gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold">
              {SEVERITY_ICONS[insight.severity]}
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{insight.title}</p>
              <p className="mt-0.5 text-xs text-gray-600">{insight.description}</p>
              <div className="mt-2 flex items-center gap-1">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${insight.confidence * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400">
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
