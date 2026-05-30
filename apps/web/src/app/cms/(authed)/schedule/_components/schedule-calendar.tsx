'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { ScheduleCalendarData } from '@/lib/schedule/schedule-queries'
import { CalendarGrid } from './calendar-grid'
import { MetricsStrip } from './metrics-strip'
import { ScheduleBacklog } from './schedule-backlog'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const date = new Date(Date.UTC(y, m - 1, 1))
  return date.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

interface ScheduleCalendarProps {
  data: ScheduleCalendarData
}

export function ScheduleCalendar({ data }: ScheduleCalendarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const navigateToMonth = (newMonth: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', newMonth)
    router.push(`?${params.toString()}`)
  }

  const goToday = () => navigateToMonth(currentMonth())
  const goPrev = () => navigateToMonth(shiftMonth(data.month, -1))
  const goNext = () => navigateToMonth(shiftMonth(data.month, 1))
  const handleNavigateMonth = (delta: number) => navigateToMonth(shiftMonth(data.month, delta))

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[var(--bg-0)] p-4 md:p-6">
      {/* Header: navigation + month label */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goPrev}
              className="min-w-11 min-h-11 rounded-md border border-[var(--bdr-1)] p-1.5 text-[var(--t3)] hover:bg-[var(--bg-2)] hover:text-[var(--t1)] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--acc)]"
              aria-label="Mês anterior"
              data-testid="prev-month"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={goToday}
              className="min-h-11 rounded-md border border-[var(--bdr-1)] px-3 py-1 text-xs font-medium text-[var(--t2)] hover:bg-[var(--bg-2)] hover:text-[var(--t1)] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--acc)]"
              data-testid="today-button"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={goNext}
              className="min-w-11 min-h-11 rounded-md border border-[var(--bdr-1)] p-1.5 text-[var(--t3)] hover:bg-[var(--bg-2)] hover:text-[var(--t1)] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--acc)]"
              aria-label="Próximo mês"
              data-testid="next-month"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
          <h2
            className="text-base font-semibold capitalize text-[var(--t1)]"
            aria-live="polite"
          >
            {formatMonthLabel(data.month)}
          </h2>
        </div>

        {/* Legend */}
        <div
          role="group"
          aria-label="Legenda do calendário"
          className="flex flex-wrap items-center gap-4 text-2xs text-[var(--t3)] md:flex-nowrap"
        >
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--color-blog)]" aria-hidden="true" />
            Blog
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--color-newsletter)]" aria-hidden="true" />
            Newsletter
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--color-video)]" aria-hidden="true" />
            Vídeo
          </span>
        </div>
      </div>

      {/* Metrics */}
      <MetricsStrip metrics={data.metrics} />

      {/* Calendar Grid */}
      <div className="mt-4">
        <CalendarGrid
          month={data.month}
          today={data.today}
          items={data.items}
          cadenceSlots={data.cadenceSlots}
          onNavigateMonth={handleNavigateMonth}
        />
      </div>

      {/* Backlog */}
      <ScheduleBacklog backlog={data.backlog} />
    </div>
  )
}
