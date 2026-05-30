'use client'

import Link from 'next/link'
import { PlatformIcon } from './shared/platform-icon'

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
    provider: string
  }>
}

interface CalendarWeekViewProps {
  days: CalendarDay[]
  weekLabel: string
  prevWeek: string
  nextWeek: string
  dateRange: string
}

export function CalendarWeekView({ days, weekLabel, prevWeek, nextWeek, dateRange }: CalendarWeekViewProps) {
  return (
    <div>
      {/* Navigation */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2.5">
        <div className="flex items-center gap-2.5">
          <Link
            href={`/cms/social?tab=calendar&week=${prevWeek}`}
            className="inline-flex items-center justify-center rounded-[9px] border border-cms-border px-[11px] py-1.5 text-cms-text-dim transition-colors hover:text-cms-text"
            aria-label="Semana anterior"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </Link>
          <span className="font-fraunces text-[17px] font-semibold">{dateRange}</span>
          <Link
            href={`/cms/social?tab=calendar&week=${nextWeek}`}
            className="inline-flex items-center justify-center rounded-[9px] border border-cms-border px-[11px] py-1.5 text-cms-text-dim transition-colors hover:text-cms-text"
            aria-label="Próxima semana"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
        <div className="flex items-center gap-2 text-[11.5px] text-cms-text-dim">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-cms-accent">
            <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
          </svg>
          faixas claras = melhor horário sugerido
        </div>
      </div>

      {/* 7-column grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map(day => (
          <div
            key={day.dateStr}
            className={`flex min-h-[220px] flex-col rounded-[11px] border p-[9px] ${
              day.isToday
                ? 'border-cms-border-strong bg-cms-surface-2'
                : 'border-cms-border bg-cms-surface'
            }`}
          >
            {/* Day header */}
            <div className="mb-[9px] flex items-center justify-between">
              <span className={`text-xs font-semibold ${day.isToday ? 'text-cms-accent' : 'text-cms-text'}`}>
                {day.dayName}
              </span>
              <span className="font-mono text-[10px] text-cms-text-dim/60">{day.dayNum}</span>
            </div>

            {/* Events */}
            <div className="flex flex-col gap-1.5">
              {day.events.map((event, i) => (
                <Link
                  key={`${event.postId}-${i}`}
                  href={`/cms/social/${event.postId}`}
                  className="rounded-[7px] border-l-2 px-2 py-1.5 transition-opacity hover:opacity-80"
                  style={{
                    borderLeftColor: event.tint,
                    background: `${event.tint}22`,
                  }}
                >
                  <div className="mb-0.5 flex items-center gap-[5px]">
                    <PlatformIcon provider={event.provider} size={11} variant="chip" tint={event.tint} />
                    <span className="font-mono text-[9.5px] text-cms-text-dim">{event.time}</span>
                  </div>
                  <p className="text-[10.5px] leading-[1.3] text-cms-text">{event.title}</p>
                </Link>
              ))}
              {day.events.length === 0 && (
                <div className="mt-1.5 rounded-[7px] border border-dashed border-cms-border px-2 py-1.5 text-center text-[10px] text-cms-text-dim/60">
                  + slot livre
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
