'use client'

interface AbTest {
  id: string
  videoTitle: string
  status: 'active' | 'completed'
  variants: { label: string; thumbnailUrl?: string; ctr: number; impressions: number; clicks: number }[]
  confidence: number
  winner?: string
}

interface AbLabTabProps {
  tests: AbTest[]
}

export function AbLabTab({ tests }: AbLabTabProps) {
  const active = tests.filter(t => t.status === 'active')
  const completed = tests.filter(t => t.status === 'completed')

  if (tests.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-lg text-cms-text-muted">No A/B tests yet</p>
        <p className="mt-2 text-sm text-cms-text-dim">Go to Videos tab &rarr; Start A/B on any video</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-cms-text">Active Tests</h3>
          {active.map(test => (
            <div key={test.id} className="rounded-lg border border-cms-border bg-cms-surface p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-cms-text">{test.videoTitle}</p>
                <span className="text-xs text-cms-accent">Confidence: {test.confidence}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-700">
                <div className="h-full rounded-full bg-cms-accent" style={{ width: `${Math.min(test.confidence, 100)}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {test.variants.map(v => (
                  <div key={v.label} className="rounded-md border border-cms-border bg-cms-bg p-3">
                    <p className="text-xs font-medium text-cms-text-muted">{v.label}</p>
                    <p className="text-lg font-bold text-cms-text">{v.ctr.toFixed(1)}% CTR</p>
                    <p className="text-xs text-cms-text-dim">{v.impressions.toLocaleString()} impressions &middot; {v.clicks.toLocaleString()} clicks</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-cms-text">Completed Tests</h3>
          {completed.map(test => (
            <div key={test.id} className="flex items-center justify-between rounded-lg border border-cms-border bg-cms-surface px-4 py-3">
              <p className="text-sm text-cms-text">{test.videoTitle}</p>
              <div className="flex items-center gap-2">
                {test.winner && <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-400">Winner: {test.winner}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
