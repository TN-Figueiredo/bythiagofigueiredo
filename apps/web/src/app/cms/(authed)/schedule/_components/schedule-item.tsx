'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import type { CalendarItem } from '@/lib/schedule/schedule-queries'

/* ------------------------------------------------------------------ */
/*  Color + status styling                                            */
/* ------------------------------------------------------------------ */

const TYPE_COLORS: Record<string, string> = {
  blog: '#34d399',
  newsletter: '#a78bfa',
  video: '#fb7185',
}

const TYPE_LABELS: Record<string, string> = {
  blog: 'Blog',
  newsletter: 'Newsletter',
  video: 'Video',
}

function getStatusClasses(item: CalendarItem): string {
  const color = TYPE_COLORS[item.type] ?? '#94a3b8'

  switch (item.status) {
    case 'published':
      return `bg-[${color}]/12 border-l-0`
    case 'scheduled':
      return `border-l-[3px]`
    case 'queued':
      return `border-l-[3px] border-dashed`
    case 'overdue':
      return `border-l-[3px]`
    default:
      return ''
  }
}

function getStatusBorderColor(item: CalendarItem): string {
  if (item.status === 'overdue') return '#ef4444'
  return TYPE_COLORS[item.type] ?? '#94a3b8'
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
      className={`absolute top-full z-50 mt-1 w-48 rounded-md border border-slate-600 bg-slate-800 p-2.5 shadow-xl ${
        flipRight ? 'left-0' : 'right-0'
      }`}
      data-testid="schedule-tooltip"
    >
      <p className="truncate text-xs font-medium text-slate-100">
        {item.title}
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: TYPE_COLORS[item.type] }}
        />
        <span className="text-[10px] text-slate-400">
          {TYPE_LABELS[item.type]}
        </span>
      </div>
      {item.time && (
        <p className="mt-1 text-[10px] text-slate-500">
          {item.time}
        </p>
      )}
      <p className="mt-1 text-[10px] capitalize text-slate-500">
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

  const color = TYPE_COLORS[item.type] ?? '#94a3b8'
  const borderColor = getStatusBorderColor(item)

  const bgOpacity = item.status === 'published' ? '0.12' : '0.06'

  return (
    <div
      ref={ref}
      className="group relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
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
