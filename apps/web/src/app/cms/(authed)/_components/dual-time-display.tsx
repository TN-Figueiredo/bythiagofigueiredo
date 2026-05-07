'use client'

import { useMemo } from 'react'
import {
  formatSiteDateTime,
  getTimezoneOffsetHours,
  type FormatSiteDateTimeOpts,
} from '@/lib/cms/format-site-datetime'

interface DualTimeDisplayProps {
  date: Date | string
  siteTimezone: string
  mode?: FormatSiteDateTimeOpts['mode']
  showLocal?: boolean
}

export function DualTimeDisplay({
  date,
  siteTimezone,
  mode = 'short',
  showLocal = true,
}: DualTimeDisplayProps) {
  const fmt = formatSiteDateTime(date, siteTimezone, {
    mode,
    includeLocal: showLocal,
  })

  const localTz = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return 'UTC' }
  }, [])

  const isoStr = typeof date === 'string' ? date : date.toISOString()
  const d = typeof date === 'string' ? new Date(date) : date
  const offset = getTimezoneOffsetHours(siteTimezone, localTz, d)

  const crossDayLabel = fmt.crossDay
    ? offset < 0 ? '−1d' : '+1d'
    : null

  return (
    <time
      dateTime={isoStr}
      title={fmt.tooltip}
      className="inline-flex items-center gap-1.5 text-xs"
    >
      <span className="font-medium text-slate-200">{fmt.primary}</span>
      <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium text-indigo-400">
        {fmt.tzAbbr}
      </span>
      {showLocal && fmt.local && (
        <>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">{fmt.local} {fmt.localTzAbbr}</span>
          {crossDayLabel && (
            <span className="text-[10px] font-medium text-amber-500">{crossDayLabel}</span>
          )}
        </>
      )}
    </time>
  )
}
