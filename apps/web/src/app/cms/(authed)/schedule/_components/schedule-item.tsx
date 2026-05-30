'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import type { CalendarItem } from '@/lib/schedule/schedule-queries'
import { TYPE_COLORS, TYPE_LABELS } from './schedule-constants'

/* ------------------------------------------------------------------ */
/*  Status styling helpers                                            */
/* ------------------------------------------------------------------ */

function getStatusBorderColor(item: CalendarItem): string {
  if (item.status === 'overdue') return 'var(--theme-danger, #ef4444)'
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
      className={`absolute top-full z-tooltip mt-1.5 w-52 rounded-[var(--radius-xl)] border border-[var(--bdr-2)] bg-[var(--bg-2)] p-3 shadow-xl ${
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
        <span className="text-3xs text-[var(--t3)]">
          {TYPE_LABELS[item.type]}
        </span>
      </div>
      {item.time && (
        <p className="mt-1 text-3xs text-[var(--t5)]">
          {item.time}
        </p>
      )}
      <p className="mt-1 text-3xs capitalize text-[var(--t5)]">
        {item.status === 'published' ? 'Publicado' : item.status === 'scheduled' ? 'Agendado' : item.status === 'overdue' ? 'Atrasado' : item.status === 'queued' ? 'Na fila' : item.status}
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
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      data-testid={`schedule-item-${item.id}`}
    >
      <Link
        href={item.editUrl}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setShowTooltip(false)
        }}
        className={`flex items-center gap-1 truncate rounded-[var(--radius)] px-1.5 py-1 text-3xs leading-tight transition-colors ${
          item.status === 'queued' ? 'border-l-[3px] border-dashed' : ''
        } ${item.status === 'scheduled' ? 'border-l-[3px] border-dotted' : ''} ${
          item.status === 'overdue' ? 'border-l-[3px] border-solid' : ''
        }`}
        style={{
          backgroundColor: `color-mix(in srgb, ${color} ${Math.round(parseFloat(bgOpacity) * 100)}%, transparent)`,
          borderLeftColor:
            item.status !== 'published' ? borderColor : 'transparent',
          color: color,
          backgroundImage: item.status === 'scheduled'
            ? 'repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(255,255,255,0.04) 3px, rgba(255,255,255,0.04) 6px)'
            : undefined,
        }}
      >
        {/* Type indicator icon */}
        {item.status === 'scheduled' && (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 shrink-0 opacity-70" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        )}
        <span className="sr-only">{TYPE_LABELS[item.type]}: </span>
        <span className="truncate">{item.title}</span>
      </Link>
      {showTooltip && <Tooltip item={item} flipRight={flipRight} />}
    </div>
  )
}
