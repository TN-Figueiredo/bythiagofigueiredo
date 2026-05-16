'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { BlogHubStrings } from '../../_i18n/types'

function todayInSiteTz(tz: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz })
}

function tomorrowInSiteTz(tz: string): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toLocaleDateString('en-CA', { timeZone: tz })
}

function toISOInTimezone(date: string, time: string, _tz: string): string | null {
  if (!date || !time) return null
  return new Date(`${date}T${time}:00`).toISOString()
}

interface PromotionModalProps {
  isOpen: boolean
  itemTitle: string
  itemCode: string
  supportedLocales: string[]
  defaultLocale: string
  siteTimezone: string
  strings?: BlogHubStrings
  onPromote: (locale: string, scheduledFor?: string) => void
  onCancel: () => void
  loading?: boolean
}

export function PromotionModal({
  isOpen,
  itemTitle,
  itemCode,
  supportedLocales,
  defaultLocale,
  siteTimezone,
  strings,
  onPromote,
  onCancel,
  loading,
}: PromotionModalProps) {
  const [selectedLocale, setSelectedLocale] = useState(defaultLocale)
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [date, setDate] = useState(() => tomorrowInSiteTz(siteTimezone))
  const [time, setTime] = useState('09:00')
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setSelectedLocale(defaultLocale)
      setScheduleEnabled(false)
      setDate(tomorrowInSiteTz(siteTimezone))
      setTime('09:00')
    }
  }, [isOpen, defaultLocale, siteTimezone])

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
    if (scheduleEnabled) {
      const iso = toISOInTimezone(date, time, siteTimezone)
      if (!iso) return
      onPromote(selectedLocale, iso)
    } else {
      onPromote(selectedLocale)
    }
  }, [selectedLocale, scheduleEnabled, date, time, siteTimezone, onPromote])

  const s = strings?.promotion

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="promotion-modal-title"
    >
      <div className="w-full max-w-sm rounded-xl border border-gray-700 bg-gray-900 p-5 shadow-xl">
        <h2 id="promotion-modal-title" className="text-[15px] font-semibold text-gray-200">
          {s?.title ?? 'Promote to Blog'}
        </h2>

        <div className="mt-2 space-y-1 text-[12px]">
          <p className="truncate text-gray-300">{itemTitle}</p>
          <p className="font-mono text-[10px] text-gray-500">{itemCode}</p>
        </div>

        <div className="mt-4 space-y-3">
          {/* Locale selection */}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-400">
              {s?.selectLocales ?? 'Language'}
            </label>
            <div className="flex flex-wrap gap-2">
              {supportedLocales.map((loc) => (
                <label
                  key={loc}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] transition-colors ${
                    selectedLocale === loc
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="locale"
                    value={loc}
                    checked={selectedLocale === loc}
                    onChange={() => setSelectedLocale(loc)}
                    className="sr-only"
                  />
                  {loc}
                  {loc === defaultLocale && (
                    <span className="text-[8px] text-gray-500">(default)</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Schedule toggle */}
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={scheduleEnabled}
              onChange={(e) => setScheduleEnabled(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
            />
            <span className="text-[11px] text-gray-400">
              {s?.scheduleToggle ?? 'Schedule publication'}
            </span>
          </label>

          {/* Date/time pickers */}
          {scheduleEnabled && (
            <div className="flex gap-2">
              <input
                type="date"
                value={date}
                min={todayInSiteTz(siteTimezone)}
                onChange={(e) => setDate(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-[13px] text-gray-200 focus:border-indigo-500 focus:outline-none"
              />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="w-28 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-[13px] text-gray-200 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg px-3 py-1.5 text-[13px] text-gray-400 hover:bg-gray-800 hover:text-gray-200 disabled:opacity-50"
          >
            {s?.cancel ?? 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-1.5 text-[13px] font-medium text-white hover:bg-indigo-400 disabled:opacity-70"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {scheduleEnabled
              ? (s?.promoteSchedule ?? 'Promote & Schedule')
              : (s?.promote ?? 'Promote')}
          </button>
        </div>
      </div>
    </div>
  )
}
