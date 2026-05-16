'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import type { CalendarItem } from '@/lib/schedule/schedule-queries'
import { TYPE_COLORS, TYPE_LABELS } from './schedule-constants'

/* ------------------------------------------------------------------ */
/*  Status styling helpers                                            */
/* ------------------------------------------------------------------ */

function getStatusBorderColor(item: CalendarItem): string {
  if (item.status === 'overdue') return '#ef4444'
  return TYPE_COLORS[item.type] ?? 'var(--t3)'
}

/* ------------------------------------------------------------------ */
/*  Tooltip                                                           */
/* ------------------------------------------------------------------ */

function Tooltip({
  item,
  flipRight,
}: {
  item: CalendarItem
  flipRight: boolean
}) {
  return (
    <div
      role="tooltip"
      className={`absolute top-full z-50 mt-1 w-48 rounded-md border border-[var(--bdr-2)] bg-[var(--bg-2)] p-2.5 shadow-xl ${
        flipRight ? 'left-0' : 'right-0'
      }`}
      data-testid="schedule-tooltip"
    >
      <p className="truncate text-xs font-medium text-[var(--t1)]">
        {item.title}
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: TYPE_COLORS[item.type] }}
        />
        <span className="text-[10px] text-[var(--t3)]">
          {TYPE_LABELS[item.type]}
        </span>
      </div>
      {item.time && (
        <p className="mt-1 text-[10px] text-[var(--t5)]">
          {item.time}
        </p>
      )}
      <p className="mt-1 text-[10px] capitalize text-[var(--t5)]">
        {item.status}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

interface ScheduleItemProps {
  item: CalendarItem
  colIndex?: number
}

export function ScheduleItem({ item, colIndex = 0 }: ScheduleItemProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const flipRight = (colIndex ?? 0) >= 5

  // Close tooltip when clicking outside
  useEffect(() => {
    if (!showTooltip) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowTooltip(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showTooltip])

  const color = TYPE_COLORS[item.type] ?? 'var(--t3)'
  const borderColor = getStatusBorderColor(item)

  const bgOpacity = item.status === 'published' ? '0.12' : '0.06'

  return (
    <div
      ref={ref}
      className="group relative"
      tabIndex={0}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      data-testid={`schedule-item-${item.id}`}
    >
      <Link
        href={item.editUrl}
        className={`block truncate rounded px-1.5 py-0.5 text-[10px] leading-tight transition-colors ${
          item.status === 'queued' ? 'border-l-[3px] border-dashed' : ''
        } ${item.status === 'scheduled' ? 'border-l-[3px] border-solid' : ''} ${
          item.status === 'overdue' ? 'border-l-[3px] border-solid' : ''
        }`}
        style={{
          backgroundColor: `color-mix(in srgb, ${color} ${Math.round(parseFloat(bgOpacity) * 100)}%, transparent)`,
          borderLeftColor:
            item.status !== 'published' ? borderColor : 'transparent',
          color: color,
        }}
      >
        {item.title}
      </Link>
      {showTooltip && <Tooltip item={item} flipRight={flipRight} />}
    </div>
  )
}
