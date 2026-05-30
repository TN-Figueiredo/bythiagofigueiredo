'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { DashboardPeriod } from './dashboard-queries'

interface DashboardHeaderProps {
  greeting: string
  userName?: string
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
  userName,
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
      className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--bdr-1)] bg-[var(--bg-0)]/80 px-6 py-4 backdrop-blur-[12px]"
      data-testid="dashboard-header"
    >
      <div>
        <h1 className="text-lg font-semibold text-[var(--t1)]">
          {greeting}{userName ? `, ${userName}` : ''}
        </h1>
        <p className="text-sm text-[var(--t3)] capitalize">{todayLabel}</p>
      </div>
      <div className="flex gap-1 rounded-xl bg-[var(--bg-2)]/60 p-1" role="tablist" aria-label="Periodo de analise">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            role="tab"
            aria-selected={period === p.value}
            onClick={() => handlePeriodChange(p.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              period === p.value
                ? 'bg-[var(--acc)] text-white shadow-sm'
                : 'text-[var(--t3)] hover:text-[var(--t2)]'
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
