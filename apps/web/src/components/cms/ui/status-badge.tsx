const VARIANTS = {
  draft: { bg: 'bg-cms-amber-subtle', text: 'text-cms-amber', border: 'border-[rgba(245,158,11,.3)]' },
  review: { bg: 'bg-cms-amber-subtle', text: 'text-cms-amber', border: 'border-[rgba(245,158,11,.3)]' },
  ready: { bg: 'bg-cms-cyan-subtle', text: 'text-cms-cyan', border: 'border-[rgba(6,182,212,.3)]' },
  queued: { bg: 'bg-cms-purple-subtle', text: 'text-cms-purple', border: 'border-[rgba(139,92,246,.3)]' },
  published: { bg: 'bg-cms-green-subtle', text: 'text-cms-green', border: 'border-[rgba(34,197,94,.3)]' },
  live: { bg: 'bg-cms-green-subtle', text: 'text-cms-green', border: 'border-[rgba(34,197,94,.3)]' },
  archived: { bg: 'bg-cms-surface-hover', text: 'text-cms-text-dim', border: 'border-[rgba(113,113,122,.3)]' },
  scheduled: { bg: 'bg-cms-cyan-subtle', text: 'text-cms-cyan', border: 'border-[rgba(6,182,212,.3)]' },
  sent: { bg: 'bg-cms-green-subtle', text: 'text-cms-green', border: 'border-[rgba(34,197,94,.3)]' },
  sending: { bg: 'bg-cms-purple-subtle', text: 'text-cms-purple', border: 'border-[rgba(139,92,246,.3)]' },
  failed: { bg: 'bg-cms-red-subtle', text: 'text-cms-red', border: 'border-[rgba(239,68,68,.3)]' },
  pending: { bg: 'bg-cms-amber-subtle', text: 'text-cms-amber', border: 'border-[rgba(245,158,11,.3)]' },
  confirmed: { bg: 'bg-cms-green-subtle', text: 'text-cms-green', border: 'border-[rgba(34,197,94,.3)]' },
  bounced: { bg: 'bg-cms-red-subtle', text: 'text-cms-red', border: 'border-[rgba(239,68,68,.3)]' },
  unsubscribed: { bg: 'bg-cms-surface-hover', text: 'text-cms-text-dim', border: 'border-[rgba(113,113,122,.3)]' },
  complained: { bg: 'bg-cms-rose/10', text: 'text-cms-rose', border: 'border-[rgba(244,63,94,.3)]' },
  active: { bg: 'bg-cms-green-subtle', text: 'text-cms-green', border: 'border-[rgba(34,197,94,.3)]' },
  paused: { bg: 'bg-cms-amber-subtle', text: 'text-cms-amber', border: 'border-[rgba(245,158,11,.3)]' },
} as const

export type StatusVariant = keyof typeof VARIANTS

interface StatusBadgeProps {
  variant: StatusVariant
  label?: string
  /** Use pill shape (rounded-full) with a visible border — matches table row badges */
  pill?: boolean
  /** Show an animated pulse dot (e.g. for 'sending' status) */
  dot?: boolean
  className?: string
}

export function StatusBadge({ variant, label, pill = false, dot = false, className = '' }: StatusBadgeProps) {
  const v = VARIANTS[variant] ?? VARIANTS.draft
  const shape = pill
    ? `rounded-full border ${v.border}`
    : 'rounded'
  return (
    <span
      data-status={variant}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium ${shape} ${v.bg} ${v.text} ${className}`}
    >
      {dot && (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" aria-hidden="true" />
      )}
      {label ?? variant}
    </span>
  )
}
