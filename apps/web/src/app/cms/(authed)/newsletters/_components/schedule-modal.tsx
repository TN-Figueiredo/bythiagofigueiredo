'use client'

import { useState, useRef } from 'react'
import { useModalFocusTrap } from './use-modal-focus-trap'

interface ScheduleModalProps {
  open: boolean
  audienceCount: number
  onConfirm: (scheduledAt: string) => void
  onCancel: () => void
}

export function ScheduleModal({ open, audienceCount, onConfirm, onCancel }: ScheduleModalProps) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const dialogRef = useRef<HTMLDivElement>(null)

  useModalFocusTrap(dialogRef, open, onCancel)

  if (!open) return null

  function toISOInTimezone(d: string, t: string, tz: string): string {
    // Treat the user input as a datetime in the selected timezone
    const naive = new Date(`${d}T${t}:00Z`) // parse as UTC first
    if (tz === 'UTC') return naive.toISOString()
    // Compute the offset between UTC and the target timezone
    const utcStr = naive.toLocaleString('en-US', { timeZone: 'UTC' })
    const tzStr = naive.toLocaleString('en-US', { timeZone: tz })
    const offset = new Date(utcStr).getTime() - new Date(tzStr).getTime()
    return new Date(naive.getTime() + offset).toISOString()
  }

  function handleConfirm() {
    if (!date || !time) return
    const scheduledAt = toISOInTimezone(date, time, timezone)
    onConfirm(scheduledAt)
  }

  const isPast = date && time
    ? new Date(toISOInTimezone(date, time, timezone)).getTime() <= Date.now()
    : false

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-modal-title"
        className="w-full max-w-sm rounded-xl bg-[#111827] border border-[#374151] p-6 shadow-2xl"
      >
        <h3 id="schedule-modal-title" className="text-lg font-semibold text-[#f3f4f6]">Schedule Edition</h3>
        <p className="mt-1 text-sm text-[#9ca3af]">Will be sent to {audienceCount.toLocaleString()} subscribers</p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-[#9ca3af] mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full rounded border border-[#374151] bg-[#0a0f1a] text-[#d1d5db] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#9ca3af] mb-1">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded border border-[#374151] bg-[#0a0f1a] text-[#d1d5db] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#9ca3af] mb-1">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded border border-[#374151] bg-[#0a0f1a] text-[#d1d5db] px-3 py-2 text-sm"
            >
              <option value="America/Sao_Paulo">America/Sao_Paulo (BRT)</option>
              <option value="America/New_York">America/New_York (ET)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>

        {isPast && (
          <p className="mt-2 text-xs text-[#f87171]">Selected time is in the past</p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 text-sm font-medium text-[#9ca3af] hover:bg-white/5">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!date || !time || isPast}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Schedule
          </button>
        </div>
      </div>
    </div>
  )
}
