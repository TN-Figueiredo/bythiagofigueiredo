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

  return (
    <div
      className={`relative min-h-[90px] p-1.5 transition-colors ${
        !isCurrentMonth
          ? 'bg-slate-900/50'
          : isToday
            ? 'bg-sky-950/40 ring-1 ring-inset ring-sky-500/30'
            : isThisWeek
              ? 'shadow-[inset_0_0_0_1px_rgba(99,102,241,0.20)] bg-[#0f172a]'
              : 'bg-[#0f172a]'
      }`}
      data-testid={`cell-${dateKey}`}
    >
      {/* Day number */}
      <div className="mb-1 flex items-center justify-between">
        <span
          className={`text-[11px] font-medium ${
            !isCurrentMonth
              ? 'text-slate-700'
              : isToday
                ? 'text-sky-300'
                : isPast
                  ? 'text-slate-600'
                  : 'text-slate-400'
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
          <span className="block text-[9px] text-slate-500">
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
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-slate-800">
          <div
            className="h-full bg-sky-500/60 transition-all"
            style={{ width: `${todayProgress}%` }}
          />
        </div>
      )}
    </div>
  )
}
