'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { BlogHubStrings } from '../../_i18n/types'

interface ScheduleModalProps {
  isOpen: boolean
  postTitle: string
  onConfirm: (scheduledFor: string) => void
  onCancel: () => void
  strings?: BlogHubStrings
}

function getTomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}

export function ScheduleModal({ isOpen, postTitle, onConfirm, onCancel, strings }: ScheduleModalProps) {
  const [date, setDate] = useState(getTomorrow)
  const [time, setTime] = useState('09:00')
  const [error, setError] = useState<string | null>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const s = strings?.scheduleModal

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setDate(getTomorrow())
      setTime('09:00')
      setError(null)
      // Auto-focus date input
      setTimeout(() => dateRef.current?.focus(), 0)
    }
  }, [isOpen])

  // Escape key handler
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

  const handleConfirm = useCallback(() => {
    if (!date) {
      setError(s?.dateRequired ?? 'Date is required')
      return
    }
    if (date < getToday()) {
      setError(s?.datePast ?? 'Date must be in the future')
      return
    }
    setError(null)
    const iso = new Date(`${date}T${time}`).toISOString()
    onConfirm(iso)
  }, [date, time, onConfirm, s])

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-modal-title"
    >
      <div className="w-full max-w-sm rounded-xl border border-gray-700 bg-gray-900 p-5 shadow-xl">
        {/* Title */}
        <h2 id="schedule-modal-title" className="text-[15px] font-semibold text-gray-200">
          {s?.title ?? 'Schedule Post'}
        </h2>
        <p className="mt-1 truncate text-[12px] text-gray-400">
          <span className="text-gray-500">{s?.scheduling ?? 'Scheduling:'}</span>{' '}
          {postTitle}
        </p>

        {/* Inputs */}
        <div className="mt-4 space-y-3">
          {/* Date */}
          <div>
            <label htmlFor="schedule-date" className="mb-1 block text-[11px] font-medium text-gray-400">
              {s?.dateLabel ?? 'Date'}
            </label>
            <input
              ref={dateRef}
              id="schedule-date"
              type="date"
              value={date}
              min={getToday()}
              onChange={(e) => {
                setDate(e.target.value)
                setError(null)
              }}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-[13px] text-gray-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Time */}
          <div>
            <label htmlFor="schedule-time" className="mb-1 block text-[11px] font-medium text-gray-400">
              {s?.timeLabel ?? 'Time'}
            </label>
            <input
              id="schedule-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-[13px] text-gray-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Error */}
          {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>

        {/* Actions */}
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
