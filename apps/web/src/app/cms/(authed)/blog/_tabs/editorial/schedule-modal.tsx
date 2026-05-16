'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getTimezoneAbbr,
  todayInSiteTz,
  tomorrowInSiteTz,
  toISOInTimezone,
  formatSchedulePreview,
} from '@/lib/cms/format-site-datetime'
import type { BlogHubStrings } from '../../_i18n/types'

interface ScheduleModalProps {
  isOpen: boolean
  postTitle: string
  defaultDate?: string
  siteTimezone: string
  onConfirm: (scheduledFor: string) => void
  onCancel: () => void
  strings?: BlogHubStrings
}

export function ScheduleModal({ isOpen, postTitle, defaultDate, siteTimezone, onConfirm, onCancel, strings }: ScheduleModalProps) {
  const [date, setDate] = useState(() => tomorrowInSiteTz(siteTimezone))
  const [time, setTime] = useState('09:00')
  const [error, setError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const firstFocusRef = useRef<HTMLInputElement>(null)

  const siteAbbr = useMemo(() => getTimezoneAbbr(siteTimezone), [siteTimezone])
  const localTz = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return 'UTC' }
  }, [])

  const s = strings?.scheduleModal

  useEffect(() => {
    if (isOpen) {
      setDate(defaultDate ?? tomorrowInSiteTz(siteTimezone))
      setTime('09:00')
      setError(null)
      setTimeout(() => firstFocusRef.current?.focus(), 0)
    }
  }, [isOpen, defaultDate, siteTimezone])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onCancel])

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onCancel()
    },
    [onCancel],
  )

  const handleTabKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return
    const dialog = dialogRef.current
    if (!dialog) return
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'a[href], input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) return
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }, [])

  const handleConfirm = useCallback(() => {
    if (!date) {
      setError(s?.dateRequired ?? 'Date is required')
      return
    }
    if (date < todayInSiteTz(siteTimezone)) {
      setError(s?.datePast ?? 'Date must be in the future')
      return
    }
    const iso = toISOInTimezone(date, time, siteTimezone)
    if (!iso) {
      setError(s?.invalidDateTime ?? 'Invalid date or time')
      return
    }
    setError(null)
    onConfirm(iso)
  }, [date, time, siteTimezone, onConfirm, s])

  const dualTime = useMemo(() => {
    const iso = toISOInTimezone(date, time, siteTimezone)
    if (!iso) return null
    const d = new Date(iso)
    const site = formatSchedulePreview(d, siteTimezone)
    const local = formatSchedulePreview(d, localTz)
    const crossDay = site.dateKey !== local.dateKey
    return { site, local, crossDay }
  }, [date, time, siteTimezone, localTz])

  if (!isOpen) return null

  const sameTz = siteTimezone === localTz

  const crossDayWarning = s?.crossDayWarning ?? 'This publishes on {localDate} in your timezone ({siteDate} site time)'
  const crossDayMessage = dualTime
    ? crossDayWarning
        .replace('{localDate}', dualTime.local.dateStr)
        .replace('{siteDate}', dualTime.site.dateStr)
    : ''

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleOverlayClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-modal-title"
        className="w-full max-w-sm rounded-xl border border-gray-700 bg-gray-900 p-5 shadow-xl"
        onKeyDown={handleTabKey}
      >
        <h2 id="schedule-modal-title" className="text-[15px] font-semibold text-gray-200">
          {s?.title ?? 'Schedule Post'}
        </h2>
        <p className="mt-1 truncate text-[12px] text-gray-400">
          <span className="text-gray-500">{s?.scheduling ?? 'Scheduling:'}</span>{' '}
          {postTitle}
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="schedule-date" className="mb-1 block text-[11px] font-medium text-gray-400">
              {s?.dateLabel ?? 'Date'}
            </label>
            <input
              ref={firstFocusRef}
              id="schedule-date"
              type="date"
              value={date}
              min={todayInSiteTz(siteTimezone)}
              onChange={(e) => {
                setDate(e.target.value)
                setError(null)
              }}
              style={{ colorScheme: 'dark' }}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-[13px] text-gray-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="schedule-time" className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
              {s?.timeLabel ?? 'Time'}
              <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-400">{siteAbbr}</span>
            </label>
            <input
              id="schedule-time"
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
                <span className="text-gray-500">{s?.siteLabel ?? 'Site:'}</span>
                <span className="font-medium text-gray-200">{dualTime.site.dateStr} at {dualTime.site.timeStr}</span>
                <span className="rounded bg-indigo-500/15 px-1 py-0.5 text-[9px] font-semibold text-indigo-400">{dualTime.site.tzAbbr}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px]">
                <span className="text-gray-500">{s?.yoursLabel ?? 'Yours:'}</span>
                <span className="text-gray-400">{dualTime.local.dateStr} at {dualTime.local.timeStr}</span>
                <span className="text-[9px] text-gray-500">{dualTime.local.tzAbbr}</span>
                {dualTime.crossDay && (
                  <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-semibold text-amber-400">{s?.crossDayBadge ?? '+1d'}</span>
                )}
              </div>
            </div>
          )}

          {dualTime?.crossDay && !sameTz && (
            <p className="text-[11px] text-amber-400">
              {crossDayMessage}
            </p>
          )}

          {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-[13px] text-gray-400 hover:bg-gray-800 hover:text-gray-200"
          >
            {s?.cancel ?? 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-lg bg-indigo-500 px-4 py-1.5 text-[13px] font-medium text-white hover:bg-indigo-400"
          >
            {s?.confirm ?? 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  )
}
