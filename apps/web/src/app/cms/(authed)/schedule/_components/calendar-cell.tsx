'use client'

import Link from 'next/link'
import type { CalendarItem, CadenceSlot } from '@/lib/schedule/schedule-queries'
import { ScheduleItem } from './schedule-item'
import { TYPE_COLORS, TYPE_LABELS } from './schedule-constants'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface CalendarCellProps {
  dateKey: string
  dayNumber: number
  isToday: boolean
  isPast: boolean
  isThisWeek: boolean
  isCurrentMonth: boolean
  items: CalendarItem[]
  cadenceSlots: CadenceSlot[]
  colIndex: number
  todayProgress?: number // 0-100, % of day elapsed
  cellIndex?: number
  isFocused?: boolean
  monthName?: string
}

/* ------------------------------------------------------------------ */
/*  Cadence ghost slot                                                */
/* ------------------------------------------------------------------ */

function CadenceGhost({ slot }: { slot: CadenceSlot }) {
  const color = TYPE_COLORS[slot.type] ?? 'var(--t3)'
  return (
    <Link
      href={slot.createUrl}
      className="group/ghost block truncate rounded-[var(--radius)] px-1.5 py-1 text-3xs leading-tight opacity-55 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--acc)]"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 6%, transparent)`,
        borderLeft: `2px dashed color-mix(in srgb, ${color} 40%, transparent)`,
        color: `color-mix(in srgb, ${color} 60%, transparent)`,
      }}
      aria-label={`Preencher slot de cadência: ${TYPE_LABELS[slot.type]}`}
    >
      <span className="hidden group-hover/ghost:inline">+ Preencher</span>
      <span className="group-hover/ghost:hidden">cadência</span>
    </Link>
  )
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function CalendarCell({
  dateKey,
  dayNumber,
  isToday,
  isPast,
  isThisWeek,
  isCurrentMonth,
  items,
  cadenceSlots,
  colIndex,
  todayProgress,
  cellIndex,
  isFocused,
  monthName,
}: CalendarCellProps) {
  const maxDisplay = 3
  const overflow = items.length - maxDisplay

  // Filter out cadence slots that already have a matching item
  const unfilledCadence = cadenceSlots.filter(
    (slot) => !items.some((i) => i.type === slot.type),
  )

  const itemCount = items.length
  const [, , dd] = dateKey.split('-')
  const ariaLabel = `${parseInt(dd!, 10)} de ${monthName ?? dateKey.split('-')[1]}, ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}`

  return (
    <div
      role="gridcell"
      tabIndex={isFocused ? 0 : -1}
      data-cell-index={cellIndex}
      className={`relative min-h-[80px] p-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--acc)] ${
        !isCurrentMonth
          ? 'bg-[var(--bg-0)]/50 opacity-40'
          : isToday
            ? 'bg-[color-mix(in_srgb,var(--acc)_15%,transparent)] border-[1.5px] border-[var(--acc)] ring-1 ring-inset ring-[var(--acc)]/30'
            : isThisWeek
              ? 'shadow-[inset_0_0_0_1px_rgba(99,102,241,0.20)] bg-[var(--bg-0)]'
              : 'bg-[var(--bg-0)]'
      }`}
      data-testid={`cell-${dateKey}`}
      aria-label={ariaLabel}
      {...(isToday ? { 'aria-current': 'date' as const } : {})}
    >
      {/* Day number */}
      <div className="mb-1 flex items-center justify-between">
        <span
          className={`font-medium ${
            !isCurrentMonth
              ? 'text-[11px] text-[var(--t5)]'
              : isToday
                ? 'text-[14px] font-bold text-[var(--acc)]'
                : isPast
                  ? 'text-[11px] text-[var(--t5)]'
                  : 'text-[11px] text-[var(--t3)]'
          }`}
        >
          {dayNumber}
        </span>
      </div>

      {/* Items */}
      <div className="space-y-0.5">
        {items.slice(0, maxDisplay).map((item) => (
          <ScheduleItem key={item.id} item={item} colIndex={colIndex} />
        ))}
        {overflow > 0 && (
          <span className="block text-[10px] text-[var(--t3)]">
            +{overflow} mais
          </span>
        )}
        {/* Cadence ghost slots (only show if space remains) */}
        {items.length < maxDisplay &&
          unfilledCadence.slice(0, maxDisplay - items.length).map((slot) => (
            <CadenceGhost key={`${slot.contextId}-${slot.dateKey}`} slot={slot} />
          ))}
      </div>

      {/* Today progress bar */}
      {isToday && todayProgress !== undefined && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--bg-2)]">
          <div
            className="h-full bg-[var(--acc)]/60 transition-all"
            style={{ width: `${todayProgress}%` }}
          />
        </div>
      )}
    </div>
  )
}
