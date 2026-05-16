'use client'

import Link from 'next/link'
import type { CalendarItem, CadenceSlot } from '@/lib/schedule/schedule-queries'
import { ScheduleItem } from './schedule-item'

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
}

/* ------------------------------------------------------------------ */
/*  Cadence ghost slot                                                */
/* ------------------------------------------------------------------ */

function CadenceGhost({ slot }: { slot: CadenceSlot }) {
  return (
    <Link
      href={slot.createUrl}
      className="group/ghost block truncate rounded px-1.5 py-0.5 text-[10px] leading-tight opacity-55 transition-opacity hover:opacity-90"
      style={{
        backgroundColor: 'rgba(167, 139, 250, 0.06)',
        borderLeft: '2px dashed rgba(167, 139, 250, 0.4)',
        color: 'rgba(167, 139, 250, 0.6)',
      }}
    >
      <span className="hidden group-hover/ghost:inline">+ Fill</span>
      <span className="group-hover/ghost:hidden">cadence slot</span>
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
}: CalendarCellProps) {
  const maxDisplay = 3
  const overflow = items.length - maxDisplay

  // Filter out cadence slots that already have a matching item
  const unfilledCadence = cadenceSlots.filter(
    (slot) => !items.some((i) => i.type === slot.type),
  )

  const itemCount = items.length
  const [, mm, dd] = dateKey.split('-')
  const ariaLabel = `${parseInt(dd!, 10)} de ${mm}, ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}`

  return (
    <div
      className={`relative min-h-[90px] p-1.5 transition-colors ${
        !isCurrentMonth
          ? 'bg-[var(--bg-0)]/50'
          : isToday
            ? 'bg-[color-mix(in_srgb,var(--acc)_15%,transparent)] ring-1 ring-inset ring-[var(--acc)]/30'
            : isThisWeek
              ? 'shadow-[inset_0_0_0_1px_rgba(99,102,241,0.20)] bg-[var(--bg-0)]'
              : 'bg-[var(--bg-0)]'
      }`}
      data-testid={`cell-${dateKey}`}
      aria-label={ariaLabel}
    >
      {/* Day number */}
      <div className="mb-1 flex items-center justify-between">
        <span
          className={`text-[11px] font-medium ${
            !isCurrentMonth
              ? 'text-[var(--t5)]'
              : isToday
                ? 'text-sky-300'
                : isPast
                  ? 'text-[var(--t5)]'
                  : 'text-[var(--t3)]'
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
          <span className="block text-[9px] text-[var(--t3)]">
            +{overflow} more
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
            className="h-full bg-sky-500/60 transition-all"
            style={{ width: `${todayProgress}%` }}
          />
        </div>
      )}
    </div>
  )
}
