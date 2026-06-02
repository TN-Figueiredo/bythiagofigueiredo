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
      className="rounded-[14px] border border-cms-border bg-cms-surface p-[20px]"
    >
      {/* Skeleton bars */}
      <div className="empty-chart-skel flex items-end gap-[8px] h-[60px] mb-[16px]">
        <span style={{ width: '22%', height: '45%' }} />
        <span style={{ width: '22%', height: '70%' }} />
        <span style={{ width: '22%', height: '55%' }} />
        <span style={{ width: '22%', height: '85%' }} />
      </div>

      {/* Icon + text */}
      <div className="flex items-start gap-[10px]">
        <IconComponent
          size={20}
          className="text-cms-text-dim shrink-0 mt-[1px]"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-cms-text mb-[3px]">
            {title}
          </div>
          <div className="text-[12px] text-cms-text-dim leading-[1.5]">
            {message}
          </div>
          {eta && (
            <div className="text-[11px] text-cms-accent mt-[6px] mono">
              ETA: {eta}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
