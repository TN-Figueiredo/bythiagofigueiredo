'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { DashboardPeriod } from './dashboard-queries'

interface DashboardHeaderProps {
  greeting: string
  todayLabel: string
  period: DashboardPeriod
}

const PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
]

export function DashboardHeader({
  greeting,
  todayLabel,
  period,
}: DashboardHeaderProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handlePeriodChange(newPeriod: DashboardPeriod) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', newPeriod)
    router.push(`/cms?${params.toString()}`)
  }

  return (
    <header
      className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700/50 bg-slate-900/80 px-6 py-4 backdrop-blur-[12px]"
      data-testid="dashboard-header"
    >
      <div>
        <h1 className="text-lg font-semibold text-slate-100">{greeting}</h1>
        <p className="text-sm text-slate-400 capitalize">{todayLabel}</p>
      </div>
      <div className="flex gap-1 rounded-lg bg-slate-800/60 p-1">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => handlePeriodChange(p.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              period === p.value
                ? 'bg-indigo-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            data-testid={`period-${p.value}`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </header>
  )
}
