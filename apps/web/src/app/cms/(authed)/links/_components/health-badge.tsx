'use client'

import { Check, AlertTriangle, Clock } from 'lucide-react'

type Health = 'ok' | 'warn' | 'broken'

const HEALTH_CONFIG: Record<Health, { bg: string; text: string; label: string; Icon: typeof Check }> = {
  ok: { bg: 'bg-green-500/15', text: 'text-green-400', label: 'saudavel', Icon: Check },
  warn: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'a expirar', Icon: Clock },
  broken: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'quebrado', Icon: AlertTriangle },
}

interface HealthBadgeProps {
  health: Health
}

export function HealthBadge({ health }: HealthBadgeProps) {
  const cfg = HEALTH_CONFIG[health] ?? HEALTH_CONFIG.ok
  const { Icon } = cfg
  return (
    <span
      data-health-badge
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.text}`}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}
