'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ScheduleSlot } from '../../_hub/hub-types'

interface MonthCalendarProps {
  slots: ScheduleSlot[]
  locale?: 'en' | 'pt-BR'
  strings?: { slotDate?: string; scheduledFor?: string; publishedOn?: string }
  onDateClick?: (date: string) => void
}

function buildMonthGrid(
  year: number,
  month: number,
  slots: ScheduleSlot[],
): Array<{
  date: string
  day: number
  inMonth: boolean
  posts: ScheduleSlot['posts']
  emptySlots: ScheduleSlot['emptySlots']
}> {
  const first = new Date(year, month, 1)
  const startOffset = first.getDay()
  const slotMap = new Map(slots.map((s) => [s.date, s]))

  return Array.from({ length: 42 }).map((_, i) => {
    const d = new Date(year, month, 1 - startOffset + i)
    const dateStr = d.toISOString().slice(0, 10)
    const slot = slotMap.get(dateStr)
    return {
      date: dateStr,
      day: d.getDate(),
      inMonth: d.getMonth() === month,
      posts: slot?.posts ?? [],
      emptySlots: slot?.emptySlots ?? [],
    }
  })
}

const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// Color by post status
const STATUS_COLORS: Record<string, string> = {
  published: 'bg-green-500/80',
  scheduled: 'bg-purple-500/80',
  queued: 'bg-cyan-500/80',
  ready: 'bg-cyan-500/60',
  draft: 'bg-gray-600/80',
  idea: 'bg-gray-700/80',
  pending_review: 'bg-orange-500/80',
}

export function MonthCalendar({ slots, locale = 'en', onDateClick }: MonthCalendarProps) {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const weekdays = locale === 'pt-BR' ? WEEKDAYS_PT : WEEKDAYS_EN
  const months = locale === 'pt-BR' ? MONTHS_PT : MONTHS_EN

  const grid = useMemo(
    () => buildMonthGrid(viewYear, viewMonth, slots),
    [viewYear, viewMonth, slots],
  )

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1)
      setViewMonth(11)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1)
      setViewMonth(0)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  function goToday() {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
  }

  return (
    <div className="overflow-hidden rounded-[10px] border border-gray-800 bg-gray-900">
      {/* Nav bar */}
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2.5">
        <button
          onClick={prevMonth}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-800 hover:text-gray-200"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-100">
            {months[viewMonth]} {viewYear}
          </h3>
          {(viewYear !== today.getFullYear() || viewMonth !== today.getMonth()) && (
            <button
              onClick={goToday}
              className="rounded-md px-2 py-0.5 text-[9px] font-medium text-indigo-400 hover:bg-indigo-500/10"
            >
              {locale === 'pt-BR' ? 'Hoje' : 'Today'}
            </button>
          )}
        </div>
        <button
          onClick={nextMonth}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-800 hover:text-gray-200"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`${months[viewMonth]} ${viewYear}`}>
          {weekdays.map((d) => (
            <div
              key={d}
              className="pb-2 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400"
            >
              {d}
            </div>
          ))}
          {grid.map((cell) => {
            const isToday = cell.date === todayStr
            const hasPosts = cell.posts.length > 0
            const hasEmpty = cell.emptySlots.length > 0
            const isPast = !isToday && cell.date < todayStr
            const isClickable = onDateClick && cell.inMonth && !isPast
            return (
              <div
                key={cell.date}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onClick={isClickable ? () => onDateClick(cell.date) : undefined}
                onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDateClick(cell.date) } } : undefined}
                className={`flex min-h-[80px] flex-col rounded-lg border p-2 transition-colors ${
                  !cell.inMonth
                    ? 'border-gray-800/30 bg-gray-950/40'
                    : isPast
                      ? 'border-gray-800/30 bg-gray-900/40 opacity-50'
                      : isToday
                        ? 'border-indigo-500/40 bg-indigo-950/20'
                        : hasPosts
                          ? 'border-gray-700/60 bg-gray-800/20 hover:border-gray-600'
                          : 'border-gray-800/50 hover:border-gray-700'
                } ${isClickable ? 'cursor-pointer hover:ring-1 hover:ring-indigo-500/40' : ''}`}
              >
                <span
                  className={`text-[11px] tabular-nums leading-none ${
                    !cell.inMonth
                      ? 'font-medium text-gray-700'
                      : isToday
                        ? 'font-bold text-indigo-400'
                        : 'font-semibold text-gray-300'
                  }`}
                >
                  {cell.day}
                </span>
                {(hasPosts || hasEmpty) && (
                  <div className="mt-1.5 flex flex-col gap-0.5">
                    {cell.posts.slice(0, 3).map((p) => (
                      <div
                        key={`${p.id}-${p.locale}`}
                        className="flex items-center gap-1 rounded px-1 py-0.5"
                        style={{ backgroundColor: p.tagColor ? `${p.tagColor}20` : '#37415120' }}
                        title={p.title}
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: p.tagColor ?? '#6b7280' }}
                        />
                        <span
                          className={`truncate text-[8px] font-medium ${
                            cell.inMonth ? 'text-gray-200' : 'text-gray-500'
                          }`}
                        >
                          {p.title || '(untitled)'}
                        </span>
                        <span
                          className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_COLORS[p.status] ?? 'bg-gray-600'}`}
                          title={p.status}
                        />
                      </div>
                    ))}
                    {cell.posts.length > 3 && (
                      <span className="px-1 text-[8px] font-medium text-gray-400">
                        +{cell.posts.length - 3} more
                      </span>
                    )}
                    {cell.emptySlots.map((slot, i) => (
                      <div
                        key={`empty-${i}`}
                        className="flex items-center gap-1 rounded border border-dashed px-1 py-0.5"
                        style={{ borderColor: '#4b556360' }}
                        title={slot.locale}
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full border border-dashed border-gray-500" />
                        <span className="truncate text-[8px] uppercase text-gray-500">
                          {slot.locale}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
