import type { ClicksSource } from '../types'

const SOURCES: { key: keyof ClicksSource; label: string; color: string }[] = [
  { key: 'blog', label: 'Blog', color: 'var(--color-blog)' },
  { key: 'newsletter', label: 'Newsletter', color: 'var(--color-newsletter)' },
  { key: 'social', label: 'Social', color: 'var(--color-link)' },
  { key: 'other', label: 'Other', color: 'var(--t3)' },
]

interface Props {
  data: ClicksSource
}

export function ClicksSourceList({ data }: Props) {
  const total = data.blog + data.newsletter + data.social + data.other

  if (total === 0) {
    return (
      <div className="rounded-lg border border-[var(--bdr-1)] bg-[var(--bg-1)] p-6 text-center" data-testid="clicks-source">
        <p className="text-sm text-[var(--t3)]">Sem dados de fontes ainda</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface p-4" data-testid="clicks-source">
      <h3 className="mb-3 text-sm font-medium text-cms-text-dim">Click Sources</h3>
      <div className="space-y-2.5">
        {SOURCES.map(({ key, label, color }) => {
          const count = data[key]
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <div
              key={key}
              className="flex items-center gap-3 rounded-md py-1.5"
              style={{ borderLeft: `3px solid ${color}`, paddingLeft: '12px' }}
            >
              <span className="flex-1 text-sm text-cms-text">{label}</span>
              <span className="text-sm font-medium tabular-nums text-cms-text">{count}</span>
              <span className="w-10 text-right text-xs text-cms-text-muted">{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
