'use client'

import { useState, useEffect, useMemo } from 'react'

interface DualClockCardsProps {
  siteTimezone: string
}

function formatTime(date: Date, tz: string): string {
  return date.toLocaleTimeString('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatDateLine(date: Date, tz: string): string {
  const weekday = date.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' })
  const day = date.toLocaleDateString('en-US', { timeZone: tz, day: 'numeric' })
  const month = date.toLocaleDateString('en-US', { timeZone: tz, month: 'short' })
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(date)
  const abbr = parts.find((p) => p.type === 'timeZoneName')?.value ?? tz
  return `${weekday}, ${day} ${month} · ${abbr}`
}

function getUtcOffset(tz: string): string {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(now)
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
}

function getOffsetDiffMinutes(tz1: string, tz2: string): number {
  const now = new Date()
  const fmt = (tz: string) => {
    const f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const p = f.formatToParts(now)
    const g = (t: string) => p.find((x) => x.type === t)?.value ?? '0'
    return Date.UTC(
      parseInt(g('year')),
      parseInt(g('month')) - 1,
      parseInt(g('day')),
      parseInt(g('hour')),
      parseInt(g('minute')),
    )
  }
  return Math.round((fmt(tz2) - fmt(tz1)) / 60000)
}

function isCrossDay(date: Date, tz1: string, tz2: string): boolean {
  const d1 = date.toLocaleDateString('sv-SE', { timeZone: tz1 })
  const d2 = date.toLocaleDateString('sv-SE', { timeZone: tz2 })
  return d1 !== d2
}

export function DualClockCards({ siteTimezone }: DualClockCardsProps) {
  const [now, setNow] = useState(() => new Date())
  const localTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const siteTime = formatTime(now, siteTimezone)
  const siteDateLine = formatDateLine(now, siteTimezone)
  const siteOffset = getUtcOffset(siteTimezone)

  const localTime = formatTime(now, localTz)
  const localDateLine = formatDateLine(now, localTz)

  const crossDay = isCrossDay(now, siteTimezone, localTz)

  const diffMin = getOffsetDiffMinutes(siteTimezone, localTz)
  const absDiffH = Math.abs(Math.round(diffMin / 60))
  const absDiffMin = Math.abs(diffMin) % 60
  const direction = diffMin > 0 ? 'ahead' : diffMin < 0 ? 'behind' : null
  const diffLabel = absDiffMin > 0
    ? `${absDiffH}h ${absDiffMin}m`
    : `${absDiffH} hour${absDiffH !== 1 ? 's' : ''}`

  const isSameTimezone = siteTimezone === localTz || diffMin === 0

  return (
    <div className="space-y-3" data-testid="dual-clock-cards">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-slate-600 bg-slate-800 p-4">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Site time now
          </div>
          <div className="text-3xl font-bold tabular-nums text-slate-100" style={{ letterSpacing: '-0.02em' }}>
            {siteTime}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {siteDateLine} ({siteOffset})
          </div>
        </div>

        <div className="rounded-md border border-slate-600 bg-slate-800 p-4">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Your time now
          </div>
          <div className="text-3xl font-bold tabular-nums text-slate-100" style={{ letterSpacing: '-0.02em' }}>
            {localTime}
            {crossDay && (
              <span className="ml-1.5 text-sm font-normal text-amber-400">+1d</span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">{localDateLine}</div>
        </div>
      </div>

      {!isSameTimezone && direction && (
        <div className="flex items-center gap-2 rounded-md border border-amber-800/30 bg-amber-950/20 px-3 py-2">
          <span className="text-xs text-amber-300">
            Your local time is <strong>{diffLabel} {direction}</strong> of the site
          </span>
        </div>
      )}

      {isSameTimezone && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-800/30 bg-emerald-950/20 px-3 py-2">
          <span className="text-xs text-emerald-400">
            Your local timezone matches the site timezone
          </span>
        </div>
      )}
    </div>
  )
}
