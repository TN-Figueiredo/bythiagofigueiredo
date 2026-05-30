import type { ClicksSource } from '../types'

const SOURCES: { key: keyof ClicksSource; label: string; color: string }[] = [
  { key: 'blog', label: 'Google', color: 'var(--color-blog)' },
  { key: 'newsletter', label: 'YouTube', color: 'var(--color-video)' },
  { key: 'video', label: 'Direto', color: 'var(--color-int)' },
  { key: 'social', label: 'Twitter', color: 'var(--color-link)' },
  { key: 'other', label: 'Outros', color: 'var(--color-newsletter)' },
]

interface Props {
  data: ClicksSource
}

export function ClicksSourceList({ data }: Props) {
  const total = data.blog + data.newsletter + data.video + data.social + data.other
  const maxCount = Math.max(data.blog, data.newsletter, data.video, data.social, data.other, 1)

  if (total === 0) {
    return (
      <div className="rounded-[10px] border border-cms-border bg-cms-surface p-6 text-center" data-testid="clicks-source">
        <p className="text-sm text-cms-text-muted">Sem dados de fontes ainda</p>
      </div>
    )
  }

  return (
    <div className="rounded-[10px] border border-cms-border bg-cms-surface p-4" data-testid="clicks-source">
      <h3 className="mb-3 text-sm font-medium text-cms-text-dim">Traffic Sources</h3>
      <div className="space-y-3">
        {SOURCES.map(({ key, label, color }) => {
          const count = data[key]
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          const barWidth = maxCount > 0 ? Math.max((count / maxCount) * 100, 2) : 0
          return (
            <div key={key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-cms-text">
                  <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
                  {label}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-medium tabular-nums text-cms-text">{count}</span>
                  <span className="w-10 text-right text-cms-text-muted">{pct}%</span>
                </span>
              </div>
              <div className="h-[5px] overflow-hidden rounded-full bg-cms-border">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${barWidth}%`, background: color }}
                  role="progressbar"
                  aria-valuenow={count}
                  aria-valuemax={maxCount}
                  aria-label={`${label}: ${count} (${pct}%)`}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
