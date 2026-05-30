'use client'

import Link from 'next/link'
import type { CalendarItem, CadenceSlot } from '@/lib/schedule/schedule-queries'
import { TYPE_COLORS, TYPE_LABELS } from './schedule-constants'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function getWeekDays(weekStart: string): string[] {
  const [y, m, d] = weekStart.split('-').map(Number) as [number, number, number]
  const start = new Date(Date.UTC(y, m - 1, d))
  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    const dt = new Date(start.getTime() + i * 86_400_000)
    days.push(
      `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`,
    )
  }
  return days
}

function getDayProgress(): number {
  const now = new Date()
  const hours = now.getHours()
  const minutes = now.getMinutes()
  return Math.round(((hours * 60 + minutes) / 1440) * 100)
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

function WeekItem({ item }: { item: CalendarItem }) {
  const color = TYPE_COLORS[item.type] ?? 'var(--t3)'
  const borderColor = item.status === 'overdue' ? 'var(--theme-danger, #ef4444)' : color

  return (
    <Link
      href={item.editUrl}
      className={`group flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--bg-2)] ${
        item.status === 'overdue' ? 'border-l-[3px] border-solid' : ''
      } ${item.status === 'scheduled' ? 'border-l-[3px] border-solid' : ''} ${
        item.status === 'queued' ? 'border-l-[3px] border-dashed' : ''
      }`}
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 6%, transparent)`,
        borderLeftColor:
          item.status !== 'published' ? borderColor : 'transparent',
      }}
      data-testid={`week-item-${item.id}`}
    >
      <span
        className="mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-[var(--t1)]">
          {item.title}
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--t4)]">
          <span style={{ color }}>{TYPE_LABELS[item.type]}</span>
          {item.time && <span>{item.time}</span>}
          <span className="capitalize">{item.status === 'published' ? 'Publicado' : item.status === 'scheduled' ? 'Agendado' : item.status === 'overdue' ? 'Atrasado' : item.status === 'queued' ? 'Na fila' : item.status}</span>
        </div>
      </div>
    </Link>
  )
}

function WeekCadenceGhost({ slot }: { slot: CadenceSlot }) {
  const color = TYPE_COLORS[slot.type] ?? 'var(--t3)'
  return (
    <Link
      href={slot.createUrl}
      className="group/ghost flex items-center gap-2 rounded-[var(--radius)] px-2 py-1.5 opacity-55 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--acc)]"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 6%, transparent)`,
        borderLeft: `2px dashed color-mix(in srgb, ${color} 40%, transparent)`,
      }}
      aria-label={`Preencher slot de cadência: ${TYPE_LABELS[slot.type]}`}
    >
      <span
        className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 40%, transparent)` }}
      />
      <span className="text-3xs" style={{ color: `color-mix(in srgb, ${color} 60%, transparent)` }}>
        <span className="hidden group-hover/ghost:inline">+ Preencher</span>
        <span className="group-hover/ghost:hidden">cadência</span>
      </span>
    </Link>
  )
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

interface WeekViewProps {
  weekStart: string // YYYY-MM-DD (Monday)
  today: string
  items: CalendarItem[]
  cadenceSlots: CadenceSlot[]
}

export function WeekView({ weekStart, today, items, cadenceSlots }: WeekViewProps) {
  const days = getWeekDays(weekStart)
  const todayProgress = getDayProgress()

  // Build lookup maps for the 7 days
  const itemsByDate = new Map<string, CalendarItem[]>()
  for (const item of items) {
    if (days.includes(item.dateKey)) {
      if (!itemsByDate.has(item.dateKey)) itemsByDate.set(item.dateKey, [])
      itemsByDate.get(item.dateKey)!.push(item)
    }
  }

  const cadenceByDate = new Map<string, CadenceSlot[]>()
  for (const slot of cadenceSlots) {
    if (days.includes(slot.dateKey)) {
      if (!cadenceByDate.has(slot.dateKey)) cadenceByDate.set(slot.dateKey, [])
      cadenceByDate.get(slot.dateKey)!.push(slot)
    }
  }

  return (
    <div data-testid="week-view" role="grid" aria-label="Semana">
      <div role="row" className="grid grid-cols-7 gap-px rounded-[var(--radius-xl)] border border-[var(--bdr-1)]/50 bg-[var(--bdr-1)]/50 overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
        {days.map((dateKey, i) => {
          const dayNum = parseInt(dateKey.split('-')[2]!, 10)
          const isToday = dateKey === today
          const isPast = dateKey < today
          const dayItems = itemsByDate.get(dateKey) ?? []
          const dayCadence = cadenceByDate.get(dateKey) ?? []
          const unfilledCadence = dayCadence.filter(
            (slot) => !dayItems.some((item) => item.type === slot.type),
          )

          return (
            <div
              key={dateKey}
              role="gridcell"
              className={`relative min-h-[200px] p-2 transition-colors ${
                isToday
                  ? 'bg-[color-mix(in_srgb,var(--acc)_15%,transparent)] ring-1 ring-inset ring-[var(--acc)]/30'
                  : 'bg-[var(--bg-0)]'
              }`}
              data-testid={`week-cell-${dateKey}`}
              {...(isToday ? { 'aria-current': 'date' as const } : {})}
            >
              {/* Day header */}
              <div className="mb-2 flex items-baseline gap-1">
                <span
                  className={`text-[11px] font-medium uppercase tracking-wider ${
                    isToday
                      ? 'text-[var(--acc)]'
                      : isPast
                        ? 'text-[var(--t5)]'
                        : 'text-[var(--t3)]'
                  }`}
                >
                  {WEEKDAY_LABELS[i]}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    isToday
                      ? 'text-[var(--acc)]'
                      : isPast
                        ? 'text-[var(--t5)]'
                        : 'text-[var(--t1)]'
                  }`}
                >
                  {dayNum}
                </span>
              </div>

              {/* Items */}
              <div className="space-y-1">
                {dayItems.map((item) => (
                  <WeekItem key={item.id} item={item} />
                ))}
                {unfilledCadence.map((slot) => (
                  <WeekCadenceGhost
                    key={`${slot.contextId}-${slot.dateKey}`}
                    slot={slot}
                  />
                ))}
              </div>

              {/* Today progress bar */}
              {isToday && (
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--bg-2)]">
                  <div
                    className="h-full bg-[var(--acc)]/60 transition-all"
                    style={{ width: `${todayProgress}%` }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
