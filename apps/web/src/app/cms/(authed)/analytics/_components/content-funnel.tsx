import type { FunnelData } from '../types'
import { formatNumber } from '../../_shared/format-number'

const STAGES: { key: keyof FunnelData; label: string; color: string }[] = [
  { key: 'views', label: 'Views', color: 'var(--color-int)' },
  { key: 'read50', label: 'Leu 50%+', color: 'var(--acc)' },
  { key: 'clickedLink', label: 'Clicked Link', color: 'var(--color-newsletter)' },
  { key: 'nlOpened', label: 'Abreu NL', color: 'var(--color-blog)' },
  { key: 'subscribed', label: 'Assinou', color: 'var(--color-video)' },
]

interface Props {
  funnel: FunnelData
}

export function ContentFunnel({ funnel }: Props) {
  const maxValue = Math.max(funnel.views, 1)

  return (
    <div className="rounded-[10px] border border-cms-border bg-cms-surface p-4" data-testid="content-funnel">
      <h3 className="mb-4 text-sm font-medium text-cms-text-dim">Content Funnel</h3>
      <div className="flex flex-col gap-3">
        {STAGES.map((stage, i) => {
          const value = funnel[stage.key]
          const prevValue = i > 0 ? funnel[STAGES[i - 1]!.key] : null
          const dropOff = prevValue && prevValue > 0
            ? Math.round(((prevValue - value) / prevValue) * 100)
            : null
          const barWidth = maxValue > 0 ? Math.max((value / maxValue) * 100, 2) : 0

          return (
            <div key={stage.key} data-testid={`funnel-stage-${stage.key}`}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-cms-text-muted">
                  <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: stage.color }} aria-hidden="true" />
                  {stage.label}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-bold tabular-nums text-cms-text">{formatNumber(value)}</span>
                  {dropOff !== null && (
                    <span className="text-[10px] text-red-400">-{dropOff}%</span>
                  )}
                </span>
              </div>
              <div className="h-[6px] overflow-hidden rounded-full bg-cms-border">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${barWidth}%`, background: stage.color }}
                  role="progressbar"
                  aria-valuenow={value}
                  aria-valuemax={maxValue}
                  aria-label={`${stage.label}: ${formatNumber(value)}`}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
