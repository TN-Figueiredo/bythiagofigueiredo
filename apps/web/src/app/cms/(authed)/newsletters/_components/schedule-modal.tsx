'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useModalFocusTrap } from './use-modal-focus-trap'

interface ScheduleModalProps {
  open: boolean
  audienceCount: number
  onConfirm: (scheduledAt: string) => void
  onCancel: () => void
}

function getTomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10)
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

export function ScheduleModal({ open, audienceCount, onConfirm, onCancel }: ScheduleModalProps) {
  const [date, setDate] = useState(getTomorrow)
  const [time, setTime] = useState('09:00')
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)

  useModalFocusTrap(dialogRef, open, onCancel)

  useEffect(() => {
    if (open) {
      setDate(getTomorrow())
      setTime('09:00')
      setError(null)
      setTimeout(() => dateRef.current?.focus(), 0)
    }
  }, [open])

  const handleDateClick = useCallback(() => {
    dateRef.current?.showPicker?.()
  }, [])

  const handleConfirm = useCallback(() => {
    if (!date) {
      setError('Date is required')
      return
    }
    if (date < getToday()) {
      setError('Date must be in the future')
      return
    }
    const iso = toISOInTimezone(date, time, timezone)
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
  }, [date, time, timezone, onConfirm])

  if (!open) return null

  const isPast = (() => {
    const iso = toISOInTimezone(date, time, timezone)
    if (!iso) return false
    return new Date(iso).getTime() <= Date.now()
  })()

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
              min={getToday()}
              onClick={handleDateClick}
              onChange={(e) => { setDate(e.target.value); setError(null) }}
              style={{ colorScheme: 'dark' }}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-[13px] text-gray-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="sched-time" className="mb-1 block text-[11px] font-medium text-gray-400">Time</label>
            <input
              id="sched-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-[13px] text-gray-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="sched-tz" className="mb-1 block text-[11px] font-medium text-gray-400">Timezone</label>
            <select
              id="sched-tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-[13px] text-gray-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="America/Sao_Paulo">America/Sao_Paulo (BRT)</option>
              <option value="America/New_York">America/New_York (ET)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>

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
