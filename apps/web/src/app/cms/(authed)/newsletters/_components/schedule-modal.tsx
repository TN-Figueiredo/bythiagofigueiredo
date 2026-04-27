'use client'

import { useState } from 'react'

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

  if (!open) return null

  function handleConfirm() {
    if (!date || !time) return
    const scheduledAt = new Date(`${date}T${time}`).toISOString()
    onConfirm(scheduledAt)
  }

  const isPast = date && time ? new Date(`${date}T${time}`).getTime() <= Date.now() : false

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-gray-900">Schedule Edition</h3>
        <p className="mt-1 text-sm text-gray-500">Will be sent to {audienceCount.toLocaleString()} subscribers</p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              <option value="America/Sao_Paulo">America/Sao_Paulo (BRT)</option>
              <option value="America/New_York">America/New_York (ET)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>

        {isPast && (
          <p className="mt-2 text-xs text-red-600">Selected time is in the past</p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!date || !time || isPast}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Schedule
          </button>
        </div>
      </div>
    </div>
  )
}
