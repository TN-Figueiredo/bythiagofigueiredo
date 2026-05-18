'use client'

import { useState, useTransition } from 'react'
import type { QueueSlotConfig } from '@/lib/social/queue'

const DAY_LABELS = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
] as const

const HOUR_OPTIONS = Array.from({ length: 16 }, (_, i) => i + 6) // 06:00 to 21:00

interface QueueScheduleProps {
  initialConfig: QueueSlotConfig
  onSave: (config: QueueSlotConfig) => Promise<{ ok: boolean; error?: string }>
}

export function QueueSchedule({ initialConfig, onSave }: QueueScheduleProps) {
  const [config, setConfig] = useState<QueueSlotConfig>(initialConfig)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function addSlot(day: string) {
    setConfig((prev) => {
      const hours = prev[day as keyof QueueSlotConfig] ?? []
      // Find next available hour not already used
      const available = HOUR_OPTIONS.find((h) => !hours.includes(h))
      if (available === undefined) return prev
      return { ...prev, [day]: [...hours, available].sort((a, b) => a - b) }
    })
    setSaved(false)
  }

  function removeSlot(day: string, hour: number) {
    setConfig((prev) => ({
      ...prev,
      [day]: (prev[day as keyof QueueSlotConfig] ?? []).filter(
        (h) => h !== hour,
      ),
    }))
    setSaved(false)
  }

  function updateSlotHour(day: string, oldHour: number, newHour: number) {
    setConfig((prev) => ({
      ...prev,
      [day]: (prev[day as keyof QueueSlotConfig] ?? [])
        .map((h) => (h === oldHour ? newHour : h))
        .sort((a, b) => a - b),
    }))
    setSaved(false)
  }

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await onSave(config)
      if (result.ok) {
        setSaved(true)
      } else {
        setError(result.error ?? 'Failed to save')
      }
    })
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-cms-text">
        Queue Time Slots
      </h3>
      <p className="text-xs text-cms-text-muted">
        Configure when queued posts are published. Posts added to the queue are
        assigned the next available slot.
      </p>

      <div className="space-y-3">
        {DAY_LABELS.map(({ key, label }) => {
          const hours = config[key as keyof QueueSlotConfig] ?? []
          return (
            <div key={key} className="flex items-start gap-3">
              <span className="w-10 shrink-0 pt-1.5 text-sm font-medium text-cms-text">
                {label}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="flex items-center gap-1 rounded border border-cms-border bg-cms-bg px-2 py-1"
                  >
                    <select
                      value={hour}
                      onChange={(e) =>
                        updateSlotHour(key, hour, Number(e.target.value))
                      }
                      className="bg-transparent text-sm text-cms-text focus:outline-none"
                    >
                      {HOUR_OPTIONS.map((h) => (
                        <option key={h} value={h}>
                          {String(h).padStart(2, '0')}:00
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeSlot(key, hour)}
                      aria-label={`Remove ${label} ${hour}:00`}
                      className="text-cms-text-dim hover:text-red-400"
                    >
                      x
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addSlot(key)}
                  className="rounded border border-dashed border-cms-border px-2 py-1 text-xs text-cms-text-muted hover:border-cms-accent hover:text-cms-accent"
                >
                  + Add
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      {saved && (
        <p className="text-sm text-green-400">Saved successfully</p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="rounded-lg bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover disabled:opacity-50"
      >
        {isPending ? 'Saving...' : 'Save Schedule'}
      </button>
    </div>
  )
}
