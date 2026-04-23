const VARIANTS = {
  draft: { bg: 'bg-cms-amber-subtle', text: 'text-cms-amber' },
  review: { bg: 'bg-cms-amber-subtle', text: 'text-cms-amber' },
  ready: { bg: 'bg-cms-cyan-subtle', text: 'text-cms-cyan' },
  queued: { bg: 'bg-cms-purple-subtle', text: 'text-cms-purple' },
  published: { bg: 'bg-cms-green-subtle', text: 'text-cms-green' },
  live: { bg: 'bg-cms-green-subtle', text: 'text-cms-green' },
  archived: { bg: 'bg-cms-surface-hover', text: 'text-cms-text-dim' },
  scheduled: { bg: 'bg-cms-cyan-subtle', text: 'text-cms-cyan' },
  sent: { bg: 'bg-cms-green-subtle', text: 'text-cms-green' },
  sending: { bg: 'bg-cms-purple-subtle', text: 'text-cms-purple' },
  failed: { bg: 'bg-cms-red-subtle', text: 'text-cms-red' },
  pending: { bg: 'bg-cms-amber-subtle', text: 'text-cms-amber' },
  confirmed: { bg: 'bg-cms-green-subtle', text: 'text-cms-green' },
  bounced: { bg: 'bg-cms-red-subtle', text: 'text-cms-red' },
  unsubscribed: { bg: 'bg-cms-surface-hover', text: 'text-cms-text-dim' },
  complained: { bg: 'bg-cms-rose/10', text: 'text-cms-rose' },
  active: { bg: 'bg-cms-green-subtle', text: 'text-cms-green' },
  paused: { bg: 'bg-cms-amber-subtle', text: 'text-cms-amber' },
} as const

export type StatusVariant = keyof typeof VARIANTS

interface StatusBadgeProps {
  variant: StatusVariant
  label?: string
  className?: string
}

export function StatusBadge({ variant, label, className = '' }: StatusBadgeProps) {
  const v = VARIANTS[variant] ?? VARIANTS.draft
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${v.bg} ${v.text} ${className}`}>
      {label ?? variant}
    </span>
  )
}
