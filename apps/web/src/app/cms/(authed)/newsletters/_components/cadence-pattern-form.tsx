'use client'

import { useState, useMemo, useTransition } from 'react'
import { toast } from 'sonner'
import { generateCadenceSlots, describePattern } from '@/lib/newsletter/cadence-slots'
import type { CadencePattern, Weekday } from '@/lib/newsletter/cadence-pattern'
import type { NewsletterHubStrings } from '../_i18n/types'

// ─── Constants ───────────────────────────────────────────────────────────────

const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
}

const MONTH_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Jan' }, { value: 2, label: 'Feb' }, { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' }, { value: 5, label: 'May' }, { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' }, { value: 8, label: 'Aug' }, { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' }, { value: 11, label: 'Nov' }, { value: 12, label: 'Dec' },
]

type PatternType = CadencePattern['type']

const PATTERN_TYPES: PatternType[] = [
  'daily',
  'daily_weekdays',
  'weekly',
  'biweekly',
  'every_n_days',
  'monthly_day',
  'monthly_last_day',
  'monthly_weekday',
  'monthly_last_weekday',
  'quarterly_day',
]

// ─── Default pattern builder ─────────────────────────────────────────────────

function defaultPatternForType(type: PatternType): CadencePattern {
  switch (type) {
    case 'daily': return { type: 'daily' }
    case 'daily_weekdays': return { type: 'daily_weekdays' }
    case 'weekly': return { type: 'weekly', days: ['mon'] }
    case 'biweekly': return { type: 'biweekly', day: 'mon' }
    case 'every_n_days': return { type: 'every_n_days', interval: 7 }
    case 'monthly_day': return { type: 'monthly_day', day: 1 }
    case 'monthly_last_day': return { type: 'monthly_last_day' }
    case 'monthly_weekday': return { type: 'monthly_weekday', week: 1, day: 'mon' }
    case 'monthly_last_weekday': return { type: 'monthly_last_weekday', day: 'mon' }
    case 'quarterly_day': return { type: 'quarterly_day', day: 1, months: [1, 4, 7, 10] }
  }
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface CadencePatternFormProps {
  currentPattern: CadencePattern | null
  preferredSendTime: string
  siteTimezone: string
  onSave: (pattern: CadencePattern, sendTime: string) => Promise<{ ok: boolean; error?: string }>
  strings?: NewsletterHubStrings
}

// ─── Input primitives ────────────────────────────────────────────────────────

const inputCls =
  'rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-[13px] text-gray-200 focus:border-indigo-500 focus:outline-none'
const labelCls = 'block text-[11px] font-medium text-gray-400 mb-1'

// ─── Main component ───────────────────────────────────────────────────────────

export function CadencePatternForm({
  currentPattern,
  preferredSendTime,
  siteTimezone: _siteTimezone,
  onSave,
  strings,
}: CadencePatternFormProps) {
  const cc = strings?.cadenceConfig

  const initialType: PatternType = currentPattern?.type ?? 'weekly'
  const [patternType, setPatternType] = useState<PatternType>(initialType)
  const [pattern, setPattern] = useState<CadencePattern>(
    currentPattern ?? defaultPatternForType(initialType),
  )
  const [sendTime, setSendTime] = useState(preferredSendTime || '09:00')
  const [isPending, startTransition] = useTransition()

  // Sync pattern whenever type changes (reset to defaults)
  function handleTypeChange(newType: PatternType) {
    setPatternType(newType)
    setPattern(defaultPatternForType(newType))
  }

  // ─── Preview computation ───────────────────────────────────────────────────

  const { previewDates, isValid } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    try {
      const slots365 = generateCadenceSlots(pattern, { from: today, maxSlots: 1 })
      if (slots365.length === 0) return { previewDates: [], isValid: false }
      const preview = generateCadenceSlots(pattern, { from: today, maxSlots: 6 })
      return { previewDates: preview, isValid: true }
    } catch {
      return { previewDates: [], isValid: false }
    }
  }, [pattern])

  const patternDescription = useMemo(() => {
    try {
      return describePattern(pattern, 'en')
    } catch {
      return ''
    }
  }, [pattern])

  // ─── Save ─────────────────────────────────────────────────────────────────

  function handleSave() {
    if (!isValid) {
      toast.error(cc?.noSlotsIn365 ?? 'This pattern generates no slots in the next 365 days')
      return
    }
    startTransition(async () => {
      const result = await onSave(pattern, sendTime)
      if (result.ok) {
        toast.success(strings?.schedule?.saved ?? 'Saved')
      } else {
        toast.error(result.error ?? (strings?.schedule?.updateFailed ?? 'Failed to update'))
      }
    })
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-4">

      {/* Pattern type selector */}
      <div>
        <label className={labelCls}>{cc?.patternType ?? 'Cadence type'}</label>
        <select
          value={patternType}
          onChange={(e) => handleTypeChange(e.target.value as PatternType)}
          className={`${inputCls} w-full`}
        >
          {PATTERN_TYPES.map((t) => (
            <option key={t} value={t}>
              {getPatternLabel(t, cc)}
            </option>
          ))}
        </select>
      </div>

      {/* Dynamic inputs per type */}
      <PatternInputs
        pattern={pattern}
        onChange={setPattern}
        cc={cc}
      />

      {/* Send time */}
      <div>
        <label className={labelCls}>{cc?.sendTime ?? 'Send time'}</label>
        <input
          type="time"
          value={sendTime}
          onChange={(e) => setSendTime(e.target.value)}
          className={inputCls}
          style={{ colorScheme: 'dark' }}
        />
      </div>

      {/* Preview */}
      <div>
        <p className={labelCls}>{cc?.nextDates ?? 'Next dates:'}</p>
        {!isValid ? (
          <p className="text-[11px] text-red-400">
            {cc?.noSlotsIn365 ?? 'This pattern generates no slots in the next 365 days'}
          </p>
        ) : (
          <p className="text-[12px] text-gray-300">
            {patternDescription && (
              <span className="text-gray-500 mr-2">{patternDescription} —</span>
            )}
            {previewDates.join(', ')}
          </p>
        )}
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !isValid}
          className="rounded-lg bg-indigo-500 px-4 py-1.5 text-[13px] font-medium text-white hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? '…' : (strings?.schedule?.save ?? 'Save')}
        </button>
      </div>
    </div>
  )
}

// ─── Helper: pattern type labels ─────────────────────────────────────────────

function getPatternLabel(
  type: PatternType,
  cc: NewsletterHubStrings['cadenceConfig'] | undefined,
): string {
  switch (type) {
    case 'daily': return cc?.daily ?? 'Daily'
    case 'daily_weekdays': return cc?.dailyWeekdays ?? 'Weekdays (Mon-Fri)'
    case 'weekly': return cc?.weekly ?? 'Weekly'
    case 'biweekly': return cc?.biweekly ?? 'Biweekly'
    case 'every_n_days': return cc?.everyNDays ?? 'Every N days'
    case 'monthly_day': return cc?.monthlyDay ?? 'Monthly (specific day)'
    case 'monthly_last_day': return cc?.monthlyLastDay ?? 'Monthly (last day)'
    case 'monthly_weekday': return cc?.monthlyWeekday ?? 'Monthly (Nth weekday)'
    case 'monthly_last_weekday': return cc?.monthlyLastWeekday ?? 'Monthly (last weekday)'
    case 'quarterly_day': return cc?.quarterly ?? 'Quarterly'
  }
}

// ─── Sub-component: dynamic inputs ───────────────────────────────────────────

interface PatternInputsProps {
  pattern: CadencePattern
  onChange: (p: CadencePattern) => void
  cc: NewsletterHubStrings['cadenceConfig'] | undefined
}

function PatternInputs({ pattern, onChange, cc }: PatternInputsProps) {
  switch (pattern.type) {
    case 'daily':
    case 'daily_weekdays':
    case 'monthly_last_day':
      return null

    case 'weekly':
      return (
        <div>
          <label className={labelCls}>{cc?.days ?? 'Days'}</label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((wd) => {
              const checked = pattern.days.includes(wd)
              return (
                <label
                  key={wd}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] select-none ${
                    checked
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...pattern.days, wd]
                        : pattern.days.filter((d) => d !== wd)
                      // Keep at least one day selected
                      if (next.length > 0) {
                        onChange({ ...pattern, days: next })
                      }
                    }}
                  />
                  {WEEKDAY_LABELS[wd]}
                </label>
              )
            })}
          </div>
        </div>
      )

    case 'biweekly':
      return (
        <div>
          <label className={labelCls}>{cc?.weekday ?? 'Weekday'}</label>
          <select
            value={pattern.day}
            onChange={(e) => onChange({ ...pattern, day: e.target.value as Weekday })}
            className={inputCls}
          >
            {WEEKDAYS.map((wd) => (
              <option key={wd} value={wd}>{WEEKDAY_LABELS[wd]}</option>
            ))}
          </select>
        </div>
      )

    case 'every_n_days':
      return (
        <div>
          <label className={labelCls}>{cc?.interval ?? 'Interval (days)'}</label>
          <input
            type="number"
            min={1}
            max={365}
            value={pattern.interval}
            onChange={(e) => {
              const v = Math.max(1, Math.min(365, parseInt(e.target.value, 10) || 1))
              onChange({ ...pattern, interval: v })
            }}
            className={`${inputCls} w-24`}
          />
        </div>
      )

    case 'monthly_day':
      return (
        <div>
          <label className={labelCls}>
            {cc?.day ?? 'Day'}
            <span className="ml-1 text-gray-600">(1–31, clamped to month end)</span>
          </label>
          <input
            type="number"
            min={1}
            max={31}
            value={pattern.day}
            onChange={(e) => {
              const v = Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 1))
              onChange({ ...pattern, day: v })
            }}
            className={`${inputCls} w-24`}
          />
        </div>
      )

    case 'monthly_weekday':
      return (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{cc?.week ?? 'Week'}</label>
            <select
              value={pattern.week}
              onChange={(e) => onChange({ ...pattern, week: Number(e.target.value) as 1 | 2 | 3 | 4 })}
              className={inputCls}
            >
              {([1, 2, 3, 4] as const).map((w) => (
                <option key={w} value={w}>{w === 1 ? '1st' : w === 2 ? '2nd' : w === 3 ? '3rd' : '4th'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{cc?.weekday ?? 'Weekday'}</label>
            <select
              value={pattern.day}
              onChange={(e) => onChange({ ...pattern, day: e.target.value as Weekday })}
              className={inputCls}
            >
              {WEEKDAYS.map((wd) => (
                <option key={wd} value={wd}>{WEEKDAY_LABELS[wd]}</option>
              ))}
            </select>
          </div>
        </div>
      )

    case 'monthly_last_weekday':
      return (
        <div>
          <label className={labelCls}>{cc?.weekday ?? 'Weekday'}</label>
          <select
            value={pattern.day}
            onChange={(e) => onChange({ ...pattern, day: e.target.value as Weekday })}
            className={inputCls}
          >
            {WEEKDAYS.map((wd) => (
              <option key={wd} value={wd}>{WEEKDAY_LABELS[wd]}</option>
            ))}
          </select>
        </div>
      )

    case 'quarterly_day': {
      const months = pattern.months
      return (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>{cc?.day ?? 'Day'}</label>
            <input
              type="number"
              min={1}
              max={31}
              value={pattern.day}
              onChange={(e) => {
                const v = Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 1))
                onChange({ ...pattern, day: v })
              }}
              className={`${inputCls} w-24`}
            />
          </div>
          <div>
            <label className={labelCls}>{cc?.months ?? 'Months'}</label>
            <div className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx}>
                  <select
                    value={months[idx]}
                    onChange={(e) => {
                      const updated = [...months] as [number, number, number, number]
                      updated[idx] = Number(e.target.value)
                      onChange({ ...pattern, months: updated })
                    }}
                    className={`${inputCls} w-full`}
                  >
                    {MONTH_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }
  }
}
