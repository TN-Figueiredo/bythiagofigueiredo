'use client'

import Link from 'next/link'

interface CalendarDay {
  dateStr: string
  dayName: string
  dayNum: number
  isToday: boolean
  events: Array<{
    postId: string
    title: string
    time: string
    tint: string
    status: string
  }>
}

interface CalendarWeekViewProps {
  days: CalendarDay[]
  weekLabel: string
  prevWeek: string
  nextWeek: string
}

export function CalendarWeekView({ days, weekLabel, prevWeek, nextWeek }: CalendarWeekViewProps) {
  return (
    <div>
      {/* Week navigation */}
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/cms/social?tab=calendar&week=${prevWeek}`}
          aria-label="Semana anterior"
          className="rounded-lg border border-cms-border px-3 py-1.5 text-sm text-cms-text-muted hover:text-cms-text transition-colors"
        >
          Anterior
        </Link>
        <span className="text-sm font-medium text-cms-text">{weekLabel}</span>
        <Link
          href={`/cms/social?tab=calendar&week=${nextWeek}`}
          aria-label="Proxima semana"
          className="rounded-lg border border-cms-border px-3 py-1.5 text-sm text-cms-text-muted hover:text-cms-text transition-colors"
        >
          Proxima
        </Link>
      </div>

      {/* 7-column grid */}
      <div className="grid grid-cols-7 gap-px rounded-xl border border-cms-border bg-cms-border overflow-hidden">
        {days.map(day => (
          <div
            key={day.dateStr}
            className={`min-h-[160px] bg-cms-bg p-2 ${day.isToday ? 'ring-2 ring-inset ring-cms-accent/40' : ''}`}
          >
            {/* Day header */}
            <div className="mb-2 text-center">
              <p className="text-[10px] uppercase text-cms-text-dim">{day.dayName}</p>
              <p className={`text-sm font-medium ${day.isToday ? 'text-cms-accent' : 'text-cms-text'}`}>
                {day.dayNum}
              </p>
            </div>

            {/* Events */}
            <div className="space-y-1">
              {day.events.map((event, i) => (
                <Link
                  key={`${event.postId}-${i}`}
                  href={`/cms/social/${event.postId}`}
                  className="block rounded-md border-l-2 bg-cms-surface px-2 py-1 text-xs hover:bg-cms-surface/80 transition-colors"
                  style={{ borderLeftColor: event.tint }}
                >
                  <span className="text-cms-text-muted">{event.time}</span>
                  <p className="truncate text-cms-text">{event.title}</p>
                </Link>
              ))}
              {day.events.length === 0 && (
                <p className="text-center text-xs text-cms-text-dim/50">+ slot livre</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
