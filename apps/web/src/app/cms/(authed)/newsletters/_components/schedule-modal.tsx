'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useModalFocusTrap } from '../../_shared/editor/use-modal-focus-trap'

interface ScheduleModalProps {
  open: boolean
  audienceCount: number
  siteTimezone: string
  onConfirm: (scheduledAt: string) => void
  onCancel: () => void
}

function getTzAbbr(tz: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date())
  return parts.find(p => p.type === 'timeZoneName')?.value ?? tz
}

function todayInTz(tz: string): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: tz })
}

function tomorrowInTz(tz: string): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toLocaleDateString('sv-SE', { timeZone: tz })
}

function toISOInTimezone(d: string, t: string, tz: string): string | null {
  if (!d || !t) return null
  const naive = new Date(`${d}T${t}:00Z`)
  if (isNaN(naive.getTime())) return null
  if (tz === 'UTC') return naive.toISOString()
  const utcStr = naive.toLocaleString('en-US', { timeZone: 'UTC' })
  const tzStr = naive.toLocaleString('en-US', { timeZone: tz })
  const offset = new Date(utcStr).getTime() - new Date(tzStr).getTime()
  return new Date(naive.getTime() + offset).toISOString()
}

function formatInTz(date: Date, tz: string): { dateStr: string; timeStr: string; tzAbbr: string; dateKey: string } {
  const dateStr = date.toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })
  const tzAbbr = getTzAbbr(tz)
  const dateKey = date.toLocaleDateString('sv-SE', { timeZone: tz })
  return { dateStr, timeStr, tzAbbr, dateKey }
}

export function ScheduleModal({ open, audienceCount, siteTimezone, onConfirm, onCancel }: ScheduleModalProps) {
  const [date, setDate] = useState(() => tomorrowInTz(siteTimezone))
  const [time, setTime] = useState('09:00')
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)

  const siteAbbr = useMemo(() => getTzAbbr(siteTimezone), [siteTimezone])
  const localTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])

  useModalFocusTrap(dialogRef, open, onCancel)

  useEffect(() => {
    if (open) {
      setDate(tomorrowInTz(siteTimezone))
      setTime('09:00')
      setError(null)
      setTimeout(() => dateRef.current?.focus(), 0)
    }
  }, [open, siteTimezone])

  const handleDateClick = useCallback(() => {
    dateRef.current?.showPicker?.()
  }, [])

  const handleConfirm = useCallback(() => {
    if (!date) {
      setError('Date is required')
      return
    }
    if (date < todayInTz(siteTimezone)) {
      setError('Date must be in the future')
      return
    }
    const iso = toISOInTimezone(date, time, siteTimezone)
    if (!iso) {
      setError('Invalid date or time')
      return
    }
    if (new Date(iso).getTime() <= Date.now()) {
      setError('Selected time is in the past')
      return
    }
    setError(null)
    onConfirm(iso)
  }, [date, time, siteTimezone, onConfirm])

  const dualTime = useMemo(() => {
    const iso = toISOInTimezone(date, time, siteTimezone)
    if (!iso) return null
    const d = new Date(iso)
    const site = formatInTz(d, siteTimezone)
    const local = formatInTz(d, localTz)
    const crossDay = site.dateKey !== local.dateKey
    return { site, local, crossDay }
  }, [date, time, siteTimezone, localTz])

  const isPast = useMemo(() => {
    const iso = toISOInTimezone(date, time, siteTimezone)
    if (!iso) return false
    return new Date(iso).getTime() <= Date.now()
  }, [date, time, siteTimezone])

  if (!open) return null

  const sameTz = siteTimezone === localTz

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-modal-title"
        className="w-full max-w-sm rounded-xl border border-gray-700 bg-gray-900 p-5 shadow-xl"
      >
        <h3 id="schedule-modal-title" className="text-[15px] font-semibold text-gray-200">Schedule Edition</h3>
        <p className="mt-1 text-[12px] text-gray-400">
          Will be sent to <span className="font-medium text-gray-300">{audienceCount.toLocaleString()}</span> subscribers
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="sched-date" className="mb-1 block text-[11px] font-medium text-gray-400">Date</label>
            <input
              ref={dateRef}
              id="sched-date"
              type="date"
              value={date}
              min={todayInTz(siteTimezone)}
              onClick={handleDateClick}
              onChange={(e) => { setDate(e.target.value); setError(null) }}
              style={{ colorScheme: 'dark' }}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-[13px] text-gray-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="sched-time" className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
              Time
              <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-400">{siteAbbr}</span>
            </label>
            <input
              id="sched-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-[13px] text-gray-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {dualTime && !sameTz && (
            <div className="rounded-lg border border-gray-700/60 bg-gray-800/50 px-3 py-2">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-gray-500">Site:</span>
                <span className="font-medium text-gray-200">{dualTime.site.dateStr} at {dualTime.site.timeStr}</span>
                <span className="rounded bg-indigo-500/15 px-1 py-0.5 text-[9px] font-semibold text-indigo-400">{dualTime.site.tzAbbr}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px]">
                <span className="text-gray-500">Yours:</span>
                <span className="text-gray-400">{dualTime.local.dateStr} at {dualTime.local.timeStr}</span>
                <span className="text-[9px] text-gray-500">{dualTime.local.tzAbbr}</span>
                {dualTime.crossDay && (
                  <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-semibold text-amber-400">+1d</span>
                )}
              </div>
            </div>
          )}

          {dualTime?.crossDay && !sameTz && (
            <p className="text-[11px] text-amber-400">
              This sends on {dualTime.local.dateStr} in your timezone ({dualTime.site.dateStr} site time)
            </p>
          )}

          {error && <p className="text-[11px] text-red-400">{error}</p>}
          {!error && isPast && <p className="text-[11px] text-amber-400">Selected time is in the past</p>}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-[13px] text-gray-400 hover:bg-gray-800 hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!date || !time}
            className="rounded-lg bg-indigo-500 px-4 py-1.5 text-[13px] font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            Schedule
          </button>
        </div>
      </div>
    </div>
  )
}
