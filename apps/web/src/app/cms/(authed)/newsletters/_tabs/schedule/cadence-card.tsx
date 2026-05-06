'use client'

import { useState } from 'react'
import { Pause, Play, ChevronDown, ChevronUp } from 'lucide-react'
import { describePattern } from '@/lib/newsletter/cadence-slots'
import { normalizeTime } from '@/lib/newsletter/format'
import type { CadencePattern, Weekday } from '@/lib/newsletter/cadence-pattern'
import type { CadenceConfig } from '../../_hub/hub-types'
import type { NewsletterHubStrings } from '../../_i18n/types'
import { CadencePatternForm } from '../../_components/cadence-pattern-form'
import { updateCadencePattern } from '../../actions'

const WEEKDAY_MAP: Record<string, Weekday> = {
  Sun: 'sun', Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat',
  Sunday: 'sun', Monday: 'mon', Tuesday: 'tue', Wednesday: 'wed', Thursday: 'thu', Friday: 'fri', Saturday: 'sat',
}

export function legacyToPattern(config: CadenceConfig): CadencePattern {
  const weekday = config.dayOfWeek ? WEEKDAY_MAP[config.dayOfWeek] ?? 'mon' : 'mon'
  if (config.cadenceDays === 7 && config.dayOfWeek)
    return { type: 'weekly', days: [weekday] }
  if (config.cadenceDays === 14 && config.dayOfWeek)
    return { type: 'biweekly', day: weekday }
  return { type: 'every_n_days', interval: config.cadenceDays || 7 }
}

interface CadenceCardProps {
  config: CadenceConfig
  siteTimezone: string
  locale: 'en' | 'pt-BR'
  onTogglePause?: (typeId: string, paused: boolean) => void
  strings?: NewsletterHubStrings
}

export function CadenceCard({ config, siteTimezone, locale, onTogglePause, strings }: CadenceCardProps) {
  const s = strings?.schedule
  const [expanded, setExpanded] = useState(false)

  const effectivePattern = config.cadencePattern ?? legacyToPattern(config)
  const time = normalizeTime(config.time)

  let summaryText: string
  try {
    summaryText = describePattern(effectivePattern, locale)
  } catch {
    summaryText = config.cadence
  }

  async function handlePatternSave(pattern: CadencePattern, sendTime: string) {
    return updateCadencePattern(config.typeId, pattern, sendTime)
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: config.typeColor }} />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium text-gray-200">{config.typeName}</div>
          <div className="text-[9px] text-gray-500">
            {summaryText} · {time}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] tabular-nums text-gray-400">{config.subscribers} {s?.subs ?? 'subs'}</div>
          <div className="text-[9px] text-gray-600">{config.openRate.toFixed(0)}% {s?.openRate ?? 'open rate'}</div>
        </div>
        {config.conflicts.length > 0 && (
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-medium text-amber-400">
            {config.conflicts.length} {config.conflicts.length > 1 ? (s?.conflicts ?? 'conflicts') : (s?.conflict ?? 'conflict')}
          </span>
        )}
        <button
          onClick={() => onTogglePause?.(config.typeId, !config.paused)}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
            config.paused ? 'border-amber-500/30 text-amber-400 hover:bg-amber-950/20' : 'border-gray-700 text-gray-400 hover:bg-gray-800'
          }`}
          aria-label={config.paused ? (s?.resumeCadence ?? 'Resume cadence') : (s?.pauseCadence ?? 'Pause cadence')}
        >
          {config.paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
        </button>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-700 text-gray-400 hover:bg-gray-800"
          aria-label={expanded ? (s?.collapse ?? 'Collapse') : (s?.editCadence ?? 'Edit cadence')}
          aria-expanded={expanded}
          data-testid={`cadence-expand-${config.typeId}`}
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-800 px-4 py-3" data-testid={`cadence-form-${config.typeId}`}>
          <CadencePatternForm
            currentPattern={effectivePattern}
            preferredSendTime={time}
            siteTimezone={siteTimezone}
            locale={locale}
            onSave={handlePatternSave}
            strings={strings}
          />
          <div className="flex justify-start mt-2">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-md px-3 py-1.5 text-[10px] font-medium text-gray-400 hover:bg-gray-800"
            >
              {s?.collapse ?? 'Collapse'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
