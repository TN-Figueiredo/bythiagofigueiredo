'use client'

import {
  TrendingUp, Crosshair, BarChart3, LineChart, Target, RefreshCw, Filter,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  TrendingUp,
  Crosshair,
  BarChart3,
  LineChart,
  Target,
  RefreshCw,
  Filter,
}

export interface EmptyChartProps {
  /** Lucide icon name rendered at 24px above the title. */
  icon: string
  /** Short title (e.g. "Grafico de confianca"). */
  title: string
  /** Explanatory message (e.g. "Dados insuficientes para exibir"). */
  message: string
  /** Estimated time until data is available. Null hides the ETA. */
  eta: string | null
}

export function EmptyChart({ icon, title, message, eta }: EmptyChartProps) {
  const IconComponent = ICON_MAP[icon] ?? TrendingUp

  return (
    <div
      data-testid="empty-chart"
      className="empty-chart-centered rounded-[14px] border border-cms-border bg-cms-surface"
    >
      {/* Skeleton bars — fixed-width with gradient and top-only radius */}
      <div className="empty-chart-skel flex items-end gap-[10px]" style={{ height: 70, opacity: 0.5 }}>
        <span style={{ width: 26, height: '40%', borderRadius: '5px 5px 0 0', background: 'linear-gradient(180deg, var(--cms-surface-3, #2E281F), var(--cms-surface-2, #272219))' }} />
        <span style={{ width: 26, height: '65%', borderRadius: '5px 5px 0 0', background: 'linear-gradient(180deg, var(--cms-surface-3, #2E281F), var(--cms-surface-2, #272219))' }} />
        <span style={{ width: 26, height: '50%', borderRadius: '5px 5px 0 0', background: 'linear-gradient(180deg, var(--cms-surface-3, #2E281F), var(--cms-surface-2, #272219))' }} />
        <span style={{ width: 26, height: '80%', borderRadius: '5px 5px 0 0', background: 'linear-gradient(180deg, var(--cms-surface-3, #2E281F), var(--cms-surface-2, #272219))' }} />
      </div>

      {/* Icon + text — centered below bars */}
      <div className="flex items-center gap-[8px] text-center" style={{ maxWidth: 340, lineHeight: 1.4 }}>
        <IconComponent
          size={18}
          className="text-cms-text-muted shrink-0"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <div className="text-[12.5px] text-cms-text-muted">
            {title} — {message}
          </div>
          {eta && (
            <div className="text-[11px] text-cms-accent mt-[4px] mono">
              ETA: {eta}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
