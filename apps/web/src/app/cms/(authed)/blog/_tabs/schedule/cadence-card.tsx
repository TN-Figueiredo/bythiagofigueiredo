'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Pause, Play, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import type { BlogCadenceConfig } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'
import { updateBlogCadence } from '../../actions'

function getNextDateForDay(dayIndex: number): string {
  const now = new Date()
  const current = now.getUTCDay()
  const diff = (dayIndex - current + 7) % 7 || 7
  const next = new Date(now)
  next.setDate(now.getDate() + diff)
  return next.toISOString().slice(0, 10)
}

function getDayIndexFromDate(dateStr: string | null): number {
  if (!dateStr) return 1
  return new Date(dateStr + 'T00:00:00').getUTCDay()
}

const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

interface CadenceCardProps {
  config: BlogCadenceConfig
  onTogglePause?: (locale: string, paused: boolean) => void
  strings?: BlogHubStrings
}

export function CadenceCard({ config, onTogglePause, strings }: CadenceCardProps) {
  const s = strings?.schedule
  const [expanded, setExpanded] = useState(false)
  const [cadenceDays, setCadenceDays] = useState(String(config.cadenceDays ?? 7))
  const [sendTime, setSendTime] = useState(config.preferredSendTime || '09:00')
  const [startDayIdx, setStartDayIdx] = useState(getDayIndexFromDate(config.cadenceStartDate))
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    setCadenceDays(String(config.cadenceDays ?? 7))
    setSendTime(config.preferredSendTime || '09:00')
    setStartDayIdx(getDayIndexFromDate(config.cadenceStartDate))
  }, [config.cadenceDays, config.preferredSendTime, config.cadenceStartDate])

  function handleSave() {
    const days = parseInt(cadenceDays, 10)
    if (isNaN(days) || days < 1 || days > 365) {
      toast.error(s?.cadenceRangeError ?? 'Cadence must be 1–365 days')
      return
    }
    if (!/^\d{2}:\d{2}$/.test(sendTime)) {
      toast.error(s?.timeFormatError ?? 'Invalid time format')
      return
    }
    startTransition(async () => {
      const result = await updateBlogCadence(config.locale, {
        cadence_days: days,
        preferred_send_time: sendTime,
        cadence_start_date: getNextDateForDay(startDayIdx),
      })
      if (result.ok) {
        toast.success(s?.saved ?? 'Saved')
        setExpanded(false)
      } else {
        toast.error('error' in result ? result.error : (s?.updateFailed ?? 'Failed'))
      }
    })
  }

  const isPaused = config.cadencePaused

  return (
    <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-200">
            {config.locale}
          </div>
          <div className="text-[9px] text-gray-500">
            {config.cadenceDays} {s?.daysUnit ?? 'days'} · {config.preferredSendTime}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {config.lastPublishedAt && (
            <div className="text-[9px] text-gray-600">
              {new Date(config.lastPublishedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </div>
          )}
        </div>
        <button
          onClick={() => onTogglePause?.(config.locale, !isPaused)}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
            isPaused
              ? 'border-amber-500/30 text-amber-400 hover:bg-amber-950/20'
              : 'border-gray-700 text-gray-400 hover:bg-gray-800'
          }`}
          aria-label={
            isPaused
              ? (s?.resumeCadence ?? 'Resume cadence')
              : (s?.pauseCadence ?? 'Pause cadence')
          }
        >
          {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
        </button>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-700 text-gray-400 hover:bg-gray-800"
          aria-label={expanded ? 'Collapse' : (s?.editCadence ?? 'Edit cadence')}
          aria-expanded={expanded}
          data-testid={`cadence-expand-${config.locale}`}
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {expanded && (
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}
          className="space-y-3 border-t border-gray-800 px-4 py-3"
          data-testid={`cadence-form-${config.locale}`}
        >
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-medium text-gray-500">
                {s?.cadenceConfig ?? 'Cadence'} ({s?.daysUnit ?? 'days'})
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={cadenceDays}
                onChange={(e) => setCadenceDays(e.target.value)}
                className="w-full rounded-md border border-gray-700 bg-gray-950 px-2.5 py-1.5 text-xs text-gray-100 tabular-nums focus:border-indigo-500 focus:outline-none"
                data-testid={`cadence-days-${config.locale}`}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-gray-500">
                {s?.startDay ?? 'Start Day'}
              </label>
              <select
                value={startDayIdx}
                onChange={(e) => setStartDayIdx(Number(e.target.value))}
                className="w-full rounded-md border border-gray-700 bg-gray-950 px-2.5 py-1.5 text-xs text-gray-100 focus:border-indigo-500 focus:outline-none"
                data-testid={`cadence-day-${config.locale}`}
              >
                {DAY_KEYS.map((day, i) => (
                  <option key={i} value={i}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-gray-500">
                {s?.publishTime ?? 'Publish Time'}
              </label>
              <input
                type="time"
                value={sendTime}
                onChange={(e) => setSendTime(e.target.value)}
                className="w-full rounded-md border border-gray-700 bg-gray-950 px-2.5 py-1.5 text-xs text-gray-100 focus:border-indigo-500 focus:outline-none"
                data-testid={`cadence-time-${config.locale}`}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCadenceDays(String(config.cadenceDays ?? 7))
                setSendTime(config.preferredSendTime || '09:00')
                setStartDayIdx(getDayIndexFromDate(config.cadenceStartDate))
                setExpanded(false)
              }}
              className="rounded-md px-3 py-1.5 text-[10px] font-medium text-gray-400 hover:bg-gray-800"
            >
              {s?.cancelEdit ?? 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-indigo-500 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
              data-testid={`cadence-save-${config.locale}`}
            >
              {isPending ? '...' : (s?.save ?? 'Save')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
