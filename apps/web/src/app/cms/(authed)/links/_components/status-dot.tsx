'use client'

type LinkStatus = 'active' | 'paused' | 'expired'

const STATUS_CONFIG: Record<LinkStatus, { dot: string; label: string; text: string }> = {
  active: { dot: 'bg-green-500', label: 'Ativo', text: 'text-green-400' },
  paused: { dot: 'bg-amber-500', label: 'Pausado', text: 'text-amber-400' },
  expired: { dot: 'bg-red-500', label: 'Expirado', text: 'text-red-400' },
}

interface StatusDotProps {
  status: LinkStatus
}

export function StatusDot({ status }: StatusDotProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.active
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${cfg.text}`}>
      <span
        data-status-dot
        className={`h-[7px] w-[7px] rounded-full ${cfg.dot}`}
      />
      {cfg.label}
    </span>
  )
}
