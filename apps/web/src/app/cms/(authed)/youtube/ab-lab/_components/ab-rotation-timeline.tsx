'use client'

import { useMemo } from 'react'

interface Cycle {
  id: string
  variant_id: string
  cycle_number: number
  started_at: string
  ended_at: string | null
  backfill_status: string
}

interface Variant {
  id: string
  label: string
  is_original: boolean
}

interface AbRotationTimelineProps {
  cycles: Cycle[]
  variants: Variant[]
  today: string
  totalDays: number
}

const VARIANT_COLORS: Record<string, string> = {
  original: '#4b5563',
  variant_b: '#3b82f6',
  variant_c: '#a855f7',
  variant_d: '#14b8a6',
}

const VARIANT_BG_CLASS: Record<string, string> = {
  original: 'bg-gray-600',
  variant_b: 'bg-blue-500',
  variant_c: 'bg-purple-500',
  variant_d: 'bg-teal-500',
}

function getVariantColor(label: string): string {
  return VARIANT_COLORS[label] ?? '#6b7280'
}

function getVariantBgClass(label: string): string {
  return VARIANT_BG_CLASS[label] ?? 'bg-gray-500'
}

function isoToMs(iso: string): number {
  return new Date(iso).getTime()
}

export function AbRotationTimeline({ cycles, variants, today, totalDays }: AbRotationTimelineProps) {
  const { days, variantsUsed } = useMemo(() => {
    const todayMs = isoToMs(today)

    const days = Array.from({ length: totalDays }, (_, i) => {
      const dayNumber = i + 1
      const matchingCycle = cycles.find(c => {
        const start = isoToMs(c.started_at)
        const end = c.ended_at ? isoToMs(c.ended_at) : Infinity
        const dayOffset = i * 86400000
        return start <= todayMs - (totalDays - dayNumber) * 86400000 && end > todayMs - (totalDays - dayNumber) * 86400000
      }) ?? cycles.find(c => c.cycle_number === dayNumber) ?? null

      const isToday = dayNumber === totalDays
      const isFuture = !matchingCycle

      return { dayNumber, cycle: matchingCycle, isToday, isFuture }
    })

    const usedVariantIds = new Set(cycles.map(c => c.variant_id))
    const variantsUsed = variants.filter(v => usedVariantIds.has(v.id))

    return { days, variantsUsed }
  }, [cycles, variants, today, totalDays])

  const variantById = useMemo(() => {
    const map = new Map<string, Variant>()
    for (const v of variants) map.set(v.id, v)
    return map
  }, [variants])

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div className="flex gap-[2px]" style={{ minWidth: totalDays * 26 }}>
          {days.map(({ dayNumber, cycle, isToday, isFuture }) => {
            const variant = cycle ? variantById.get(cycle.variant_id) : null
            const label = variant?.label ?? ''
            const bgClass = label ? getVariantBgClass(label) : ''

            return (
              <div
                key={dayNumber}
                title={variant ? `Day ${dayNumber}: ${label}` : `Day ${dayNumber}: pending`}
                className={[
                  'relative flex items-center justify-center rounded-sm text-[9px] font-bold text-white select-none flex-shrink-0',
                  bgClass || 'border border-dashed border-cms-border',
                  isToday ? 'ring-2 ring-amber-400' : '',
                  isFuture ? 'opacity-40' : '',
                ].filter(Boolean).join(' ')}
                style={{ width: 24, height: 32 }}
              >
                {dayNumber}
              </div>
            )
          })}
        </div>
      </div>

      {variantsUsed.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {variantsUsed.map(v => (
            <div key={v.id} className="flex items-center gap-1.5">
              <span
                className="inline-block rounded-full"
                style={{ width: 8, height: 8, background: getVariantColor(v.label), flexShrink: 0 }}
              />
              <span className="text-xs text-cms-text-muted">{v.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
