'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import Link from 'next/link'
import type { CalendarItem, CadenceSlot } from '@/lib/schedule/schedule-queries'
import { CalendarCell } from './calendar-cell'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function getMonthGridDays(month: string): string[] {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const firstOfMonth = new Date(Date.UTC(y, m - 1, 1))
  // Monday = 0, offset to Monday start
  const dow = firstOfMonth.getUTCDay() // 0=Sun, 1=Mon...
  const mondayOffset = dow === 0 ? 6 : dow - 1

  const days: string[] = []
  const startDate = new Date(firstOfMonth.getTime() - mondayOffset * 86_400_000)

  // 6 rows x 7 cols = 42 cells
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate.getTime() + i * 86_400_000)
    const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
    days.push(dateStr)
  }

  return days
}

function getThisWeekRange(today: string): { start: string; end: string } {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number]
  const todayDate = new Date(Date.UTC(y, m - 1, d))
  const dow = todayDate.getUTCDay()
  const mondayOffset = dow === 0 ? 6 : dow - 1
  const monday = new Date(todayDate.getTime() - mondayOffset * 86_400_000)
  const sunday = new Date(monday.getTime() + 6 * 86_400_000)

  const fmt = (dt: Date) =>
    `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`

  return { start: fmt(monday), end: fmt(sunday) }
}

function getDayProgress(): number {
  const now = new Date()
  const hours = now.getHours()
  const minutes = now.getMinutes()
  return Math.round(((hours * 60 + minutes) / 1440) * 100)
}

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}

const MONTH_NAMES_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

const WEEKDAY_HEADERS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

interface CalendarGridProps {
  month: string // YYYY-MM
  today: string // YYYY-MM-DD
  items: CalendarItem[]
  cadenceSlots: CadenceSlot[]
  onNavigateMonth?: (delta: number) => void
}

/* ------------------------------------------------------------------ */
/*  Mobile Agenda View                                                */
/* ------------------------------------------------------------------ */

function MobileAgendaView({
  days,
  monthStart,
  monthEnd,
  today,
  itemsByDate,
  cadenceByDate,
}: {
  days: string[]
  monthStart: string
  monthEnd: string
  today: string
  itemsByDate: Map<string, CalendarItem[]>
  cadenceByDate: Map<string, CadenceSlot[]>
}) {
  const currentMonthDays = days.filter(d => d >= monthStart && d <= monthEnd)
  const daysWithContent = currentMonthDays.filter(d => {
    const items = itemsByDate.get(d) ?? []
    const cadence = cadenceByDate.get(d) ?? []
    return items.length > 0 || cadence.length > 0 || d === today
  })

  const displayDays = daysWithContent.length > 0 ? daysWithContent : currentMonthDays.slice(0, 7)

  return (
    <div className="space-y-2" role="list" aria-label="Agenda do mês">
      {displayDays.map((dateKey) => {
        const dayNum = parseInt(dateKey.split('-')[2]!, 10)
        const monthNum = parseInt(dateKey.split('-')[1]!, 10)
        const items = itemsByDate.get(dateKey) ?? []
        const cadence = cadenceByDate.get(dateKey) ?? []
        const isToday = dateKey === today
        const dayOfWeek = new Date(dateKey + 'T00:00:00Z').getUTCDay()
        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

        return (
          <div
            key={dateKey}
            role="listitem"
            className={`rounded-[var(--radius-xl)] border p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ${
              isToday
                ? 'border-[var(--acc)]/40 bg-[color-mix(in_srgb,var(--acc)_10%,transparent)]'
                : 'border-[var(--bdr-1)]/50 bg-[var(--bg-0)]'
            }`}
            {...(isToday ? { 'aria-current': 'date' as const } : {})}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className={`text-sm font-semibold ${isToday ? 'text-[var(--acc)]' : 'text-[var(--t1)]'}`}>
                {dayNames[dayOfWeek]} {dayNum}
              </span>
              {isToday && (
                <span className="rounded-full bg-[var(--acc)] px-2 py-0.5 text-[10px] font-medium text-white">
                  Hoje
                </span>
              )}
              <span className="text-[11px] text-[var(--t5)]">
                {MONTH_NAMES_PT[monthNum - 1]}
              </span>
            </div>
            {items.length === 0 && cadence.length === 0 ? (
              <p className="text-xs text-[var(--t5)]">Nenhum item</p>
            ) : (
              <div className="space-y-1.5">
                {items.map((item) => (
                  <Link
                    key={item.id}
                    href={item.editUrl}
                    className="flex items-center gap-2 rounded-[var(--radius)] px-2 py-2 min-h-11 text-sm transition-colors hover:bg-[var(--bg-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--acc)]"
                    style={{
                      borderLeft: `3px solid ${item.type === 'blog' ? 'var(--color-blog)' : item.type === 'newsletter' ? 'var(--color-newsletter)' : 'var(--color-video)'}`,
                    }}
                  >
                    <span className="text-[10px] font-medium uppercase text-[var(--t5)]">
                      {item.type === 'blog' ? 'B' : item.type === 'newsletter' ? 'N' : 'V'}
                    </span>
                    <span className="flex-1 truncate text-[var(--t1)]">{item.title}</span>
                    {item.status === 'scheduled' && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-[var(--t5)]" viewBox="0 0 20 20" fill="currentColor" aria-label="Agendado">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Desktop Calendar Grid                                             */
/* ------------------------------------------------------------------ */

export function CalendarGrid({
  month,
  today,
  items,
  cadenceSlots,
  onNavigateMonth,
}: CalendarGridProps) {
  const isMobile = useIsMobile()
  const days = getMonthGridDays(month)
  const thisWeek = getThisWeekRange(today)
  const todayProgress = getDayProgress()

  // Track focused cell for roving tabindex
  const todayIndex = days.indexOf(today)
  const [focusedIndex, setFocusedIndex] = useState(todayIndex >= 0 ? todayIndex : 0)

  // Build lookup maps
  const itemsByDate = useMemo(() => {
    const m = new Map<string, CalendarItem[]>()
    for (const item of items) {
      if (!m.has(item.dateKey)) m.set(item.dateKey, [])
      m.get(item.dateKey)!.push(item)
    }
    return m
  }, [items])

  const cadenceByDate = useMemo(() => {
    const m = new Map<string, CadenceSlot[]>()
    for (const slot of cadenceSlots) {
      if (!m.has(slot.dateKey)) m.set(slot.dateKey, [])
      m.get(slot.dateKey)!.push(slot)
    }
    return m
  }, [cadenceSlots])

  // Determine current month bounds
  const [y, m] = month.split('-').map(Number) as [number, number]
  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  // Month label for aria
  const monthLabel = `${MONTH_NAMES_PT[m - 1]} ${y}`

  // Keyboard navigation for ARIA grid pattern
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      let nextIndex = focusedIndex
      switch (e.key) {
        case 'ArrowRight':
          nextIndex = Math.min(focusedIndex + 1, days.length - 1)
          break
        case 'ArrowLeft':
          nextIndex = Math.max(focusedIndex - 1, 0)
          break
        case 'ArrowDown':
          nextIndex = Math.min(focusedIndex + 7, days.length - 1)
          break
        case 'ArrowUp':
          nextIndex = Math.max(focusedIndex - 7, 0)
          break
        case 'Home':
          nextIndex = focusedIndex - (focusedIndex % 7)
          break
        case 'End':
          nextIndex = focusedIndex - (focusedIndex % 7) + 6
          break
        case 'PageDown':
          e.preventDefault()
          onNavigateMonth?.(1)
          return
        case 'PageUp':
          e.preventDefault()
          onNavigateMonth?.(-1)
          return
        default:
          return
      }
      e.preventDefault()
      setFocusedIndex(nextIndex)
      // Focus the cell
      const cell = document.querySelector(`[data-cell-index="${nextIndex}"]`) as HTMLElement | null
      cell?.focus()
    },
    [focusedIndex, days.length, onNavigateMonth],
  )

  // Mobile: render agenda view
  if (isMobile) {
    return (
      <MobileAgendaView
        days={days}
        monthStart={monthStart}
        monthEnd={monthEnd}
        today={today}
        itemsByDate={itemsByDate}
        cadenceByDate={cadenceByDate}
      />
    )
  }

  // Group days into rows of 7 for ARIA grid rows
  const rows: string[][] = []
  for (let i = 0; i < days.length; i += 7) {
    rows.push(days.slice(i, i + 7))
  }

  return (
    <div data-testid="calendar-grid">
      {/* Day grid with ARIA grid semantics */}
      <div
        role="grid"
        aria-label={`Calendario de ${monthLabel}`}
        onKeyDown={handleGridKeyDown}
      >
        {/* Weekday headers */}
        <div role="row" className="mb-1 grid grid-cols-7 gap-px">
          {WEEKDAY_HEADERS.map((label) => (
            <div
              key={label}
              role="columnheader"
              className="py-1.5 text-center text-[11px] font-medium uppercase tracking-wider text-[var(--t5)]"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Calendar rows */}
        <div className="rounded-[var(--radius-xl)] border border-[var(--bdr-1)]/50 bg-[var(--bdr-1)]/50 overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
          {rows.map((rowDays, rowIndex) => (
            <div key={rowIndex} role="row" className="grid grid-cols-7 gap-px">
              {rowDays.map((dateKey, colIndex) => {
                const globalIndex = rowIndex * 7 + colIndex
                const dayNum = parseInt(dateKey.split('-')[2]!, 10)
                const isCurrentMonth = dateKey >= monthStart && dateKey <= monthEnd
                const isToday = dateKey === today
                const isPast = dateKey < today
                const isThisWeek = dateKey >= thisWeek.start && dateKey <= thisWeek.end

                return (
                  <CalendarCell
                    key={dateKey}
                    dateKey={dateKey}
                    dayNumber={dayNum}
                    isToday={isToday}
                    isPast={isPast}
                    isThisWeek={isThisWeek}
                    isCurrentMonth={isCurrentMonth}
                    items={itemsByDate.get(dateKey) ?? []}
                    cadenceSlots={cadenceByDate.get(dateKey) ?? []}
                    colIndex={colIndex}
                    todayProgress={isToday ? todayProgress : undefined}
                    cellIndex={globalIndex}
                    isFocused={globalIndex === focusedIndex}
                    monthName={MONTH_NAMES_PT[parseInt(dateKey.split('-')[1]!, 10) - 1] ?? ''}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
