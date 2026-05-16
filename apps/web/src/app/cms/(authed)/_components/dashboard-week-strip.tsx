'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { WeekDayItem, WeekDayDot } from './dashboard-queries'

interface DashboardWeekStripProps {
  days: WeekDayItem[]
}

const DOT_COLORS: Record<string, string> = {
  post: 'bg-[var(--color-blog)]',
  newsletter: 'bg-[var(--color-newsletter)]',
  pipeline: 'bg-[var(--color-video)]',
}

function DotTooltip({ dots, onClose }: { dots: WeekDayDot[]; onClose: () => void }) {
  return (
    <div
      role="tooltip"
      className="absolute top-full left-1/2 z-20 mt-2 w-48 -translate-x-1/2 rounded-lg border border-[var(--bdr-2)] bg-[var(--bg-2)] p-2 shadow-xl"
      data-testid="week-strip-tooltip"
    >
      <ul className="space-y-1">
        {dots.map((dot, i) => (
          <li key={i}>
            <Link
              href={dot.href}
              className="flex items-center gap-2 rounded px-2 py-1 text-xs text-[var(--t2)] hover:bg-[var(--bg-3)]/50 transition-colors"
              onClick={onClose}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_COLORS[dot.type] ?? 'bg-[var(--t5)]'}`} />
              <span className="truncate">{dot.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DashboardWeekStrip({ days }: DashboardWeekStripProps) {
  const [activeDay, setActiveDay] = useState<string | null>(null)

  function handleDayClick(date: string, dotsCount: number) {
    if (dotsCount === 0) return
    setActiveDay(activeDay === date ? null : date)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setActiveDay(null)
    }
  }

  return (
    <div
      className="rounded-xl border border-[var(--bdr-1)] bg-[var(--bg-2)]/40 p-5"
      data-testid="week-strip"
      onKeyDown={handleKeyDown}
    >
      <h2 className="mb-4 text-sm font-semibold text-[var(--t2)]">Esta Semana</h2>
      <div className="grid grid-cols-7 gap-2" data-testid="week-strip-days">
        {days.map((day) => (
          <button
            key={day.date}
            type="button"
            aria-label={`${day.label} ${day.dayOfMonth}${day.dots.length > 0 ? `, ${day.dots.length} item${day.dots.length > 1 ? 's' : ''}` : ''}`}
            onClick={() => handleDayClick(day.date, day.dots.length)}
            className={`relative flex flex-col items-center rounded-lg px-1 py-3 transition-all ${
              day.isToday
                ? 'bg-[var(--acc)] shadow-[0_0_12px_color-mix(in_srgb,var(--acc)_40%,transparent)] text-white'
                : 'text-[var(--t3)] hover:bg-[var(--bg-3)]/40'
            } ${day.dots.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
            data-testid={`week-day-${day.date}`}
          >
            <span className="text-[10px] font-medium uppercase">
              {day.label}
            </span>
            <span
              className={`mt-1 text-base font-bold tabular-nums ${
                day.isToday ? 'text-white' : 'text-[var(--t2)]'
              }`}
            >
              {day.dayOfMonth}
            </span>
            {day.dots.length > 0 && (
              <div className="mt-1.5 flex gap-0.5">
                {day.dots.slice(0, 3).map((dot, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full ${DOT_COLORS[dot.type] ?? 'bg-[var(--t5)]'}`}
                  />
                ))}
              </div>
            )}
            {activeDay === day.date && day.dots.length > 0 && (
              <DotTooltip
                dots={day.dots}
                onClose={() => setActiveDay(null)}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
