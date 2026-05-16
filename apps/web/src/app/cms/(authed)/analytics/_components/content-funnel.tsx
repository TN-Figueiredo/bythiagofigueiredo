import type { FunnelData } from '../types'
import { formatNumber } from '../../_shared/format-number'

const STAGES: { key: keyof FunnelData; label: string; color: string; flex: string }[] = [
  { key: 'views', label: 'Views', color: 'var(--color-int)', flex: '2.5' },
  { key: 'read50', label: 'Read 50%+', color: 'var(--acc)', flex: '1.8' },
  { key: 'clickedLink', label: 'Clicked Link', color: 'var(--color-newsletter)', flex: '1.2' },
  { key: 'nlOpened', label: 'NL Opened', color: 'var(--color-blog)', flex: '0.8' },
  { key: 'subscribed', label: 'Subscribed', color: '#fbbf24', flex: '0.5' }, // no amber token
]

interface Props {
  funnel: FunnelData
}

export function ContentFunnel({ funnel }: Props) {
  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface p-4" data-testid="content-funnel">
      <h3 className="mb-4 text-sm font-medium text-cms-text-dim">Content Funnel</h3>
      <div className="flex items-end gap-2">
        {STAGES.map((stage, i) => {
          const value = funnel[stage.key]
          const prevValue = i > 0 ? funnel[STAGES[i - 1]!.key] : null
          const dropOff = prevValue && prevValue > 0
            ? Math.round(((prevValue - value) / prevValue) * 100)
            : null

          return (
            <div key={stage.key} className="flex items-end gap-1" style={{ flex: stage.flex }}>
              {dropOff !== null && (
                <span className="mb-2 shrink-0 text-[10px] text-cms-text-muted">
                  -{dropOff}%
                </span>
              )}
              <div
                className="flex w-full flex-col items-center justify-center rounded-lg px-2 py-3"
                style={{ backgroundColor: `${stage.color}20`, borderLeft: `3px solid ${stage.color}` }}
                data-testid={`funnel-stage-${stage.key}`}
              >
                <span className="text-lg font-bold tabular-nums text-cms-text">
                  {formatNumber(value)}
                </span>
                <span className="mt-0.5 text-[11px] text-cms-text-muted">{stage.label}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
