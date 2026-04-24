import { StatusBadge, type StatusVariant } from '@tn-figueiredo/cms-ui/client'
import { EngagementDots, type DotStatus } from './engagement-dots'
import { TypeBadge, LgpdLockIcon } from './subscriber-icons'
import { STATUS_LABELS, type SubscriberRow } from './subscriber-table'

export function SubscriberMobileCard({ row }: { row: SubscriberRow }) {
  return (
    <div
      className="rounded-lg border p-3 mb-2"
      style={{ borderColor: 'var(--cms-border)', background: 'var(--cms-surface)' }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          {row.is_anonymized ? (
            <span
              className="font-mono text-xs italic"
              style={{ color: 'var(--cms-text-dim)' }}
            >
              {row.email}
            </span>
          ) : (
            <span
              className="font-mono text-xs truncate block"
              style={{ color: 'var(--cms-text)' }}
            >
              {row.email}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {row.is_anonymized && <LgpdLockIcon />}
          <StatusBadge variant={row.status as StatusVariant} pill label={STATUS_LABELS[row.status]} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TypeBadge
            name={row.newsletter_type_name}
            color={row.newsletter_type_color}
          />
          <EngagementDots
            dots={
              row.is_anonymized
                ? (['none', 'none', 'none', 'none', 'none'] as DotStatus[])
                : row.engagement_dots
            }
            ariaLabel="Engajamento nos últimos 5 envios"
          />
        </div>
        <span className="text-xs" style={{ color: 'var(--cms-text-dim)' }}>
          {new Date(row.subscribed_at).toLocaleDateString('pt-BR')}
        </span>
      </div>
    </div>
  )
}
