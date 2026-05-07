'use client'

import { useMemo } from 'react'
import {
  formatSiteDateTime,
  getTimezoneOffsetHours,
} from '@/lib/cms/format-site-datetime'

interface DualTimeBarProps {
  date: Date | string
  siteTimezone: string
}

export function DualTimeBar({ date, siteTimezone }: DualTimeBarProps) {
  const d = typeof date === 'string' ? new Date(date) : date
  const localTz = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return 'UTC' }
  }, [])
  const fmt = formatSiteDateTime(d, siteTimezone, { mode: 'time-only' })
  const offset = getTimezoneOffsetHours(siteTimezone, localTz, d)

  if (offset === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-700/30 bg-emerald-900/10 px-3 py-2">
        <span className="text-xs text-emerald-400">
          Site timezone matches your local time
        </span>
      </div>
    )
  }

  // offset = site wall clock − local wall clock
  // positive → site is ahead of local, negative → site is behind local
  const absOffset = Math.abs(offset)
  const direction = offset > 0 ? 'ahead' : 'behind'
  const label =
    absOffset === Math.floor(absOffset)
      ? `${absOffset}h ${direction}`
      : `${absOffset.toFixed(1)}h ${direction}`

  const crossDayLabel = fmt.crossDay
    ? offset < 0 ? '−1d' : '+1d'
    : null

  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2">
      <span className="shrink-0 text-sm" aria-hidden="true">
        🌐
      </span>
      <span className="text-xs font-medium text-slate-200">
        {fmt.primary} {fmt.tzAbbr}
      </span>

      <div className="relative flex flex-1 items-center">
        <div className="w-full border-t border-dashed border-slate-600" />
        <span className="absolute left-1/2 -translate-x-1/2 bg-slate-800/80 px-2 text-[10px] text-slate-400">
          {label}
        </span>
      </div>

      <span className="shrink-0 text-sm" aria-hidden="true">
        🖥
      </span>
      <span className="text-xs text-slate-500">
        {fmt.local} {fmt.localTzAbbr}
        {crossDayLabel && (
          <span className="ml-1 text-[10px] font-medium text-amber-500">
            {crossDayLabel}
          </span>
        )}
      </span>
    </div>
  )
}
